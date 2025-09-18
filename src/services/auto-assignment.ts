
import db from '../config/database';
import { drivers, orders, users, driverLocations } from '../schema';
import { eq, and, sql, ne, isNull, or } from 'drizzle-orm';
import { messageQueue, JobTypes } from './messageQueue';
import { realtimeAnalyticsService } from './realtimeAnalytics';

interface Location {
  latitude: number;
  longitude: number;
}

interface AssignmentCriteria {
  maxDistance: number; // in kilometers
  maxAssignments: number;
  preferredRating: number;
  requireActiveStatus: boolean;
  considerTier: boolean;
}

interface DriverCandidate {
  driverId: number;
  userId: number;
  distance: number;
  rating: number;
  activeOrders: number;
  tier: string;
  lastDelivery: Date | null;
  score: number;
}

class AutoAssignmentService {
  private defaultCriteria: AssignmentCriteria = {
    maxDistance: 10, // 10km radius
    maxAssignments: 3, // max 3 active orders per driver
    preferredRating: 4.0,
    requireActiveStatus: true,
    considerTier: true
  };

  async assignDriver(orderId: number, pickupLocation: Location, criteria?: Partial<AssignmentCriteria>): Promise<number | null> {
    const assignmentCriteria = { ...this.defaultCriteria, ...criteria };

    try {
      // Get available drivers
      const candidates = await this.findDriverCandidates(pickupLocation, assignmentCriteria);
      
      if (candidates.length === 0) {
        await realtimeAnalyticsService.trackEvent('driver_assignment_failed', {
          orderId,
          reason: 'no_candidates',
          criteria: assignmentCriteria
        });
        return null;
      }

      // Select best driver using scoring algorithm
      const selectedDriver = this.selectBestDriver(candidates);
      
      // Assign driver to order
      await this.performAssignment(orderId, selectedDriver.driverId);

      // Track analytics
      await realtimeAnalyticsService.trackEvent('driver_assigned', {
        orderId,
        driverId: selectedDriver.driverId,
        distance: selectedDriver.distance,
        score: selectedDriver.score,
        candidateCount: candidates.length
      });

      // Queue notification
      await messageQueue.add('send_notification', {
        type: 'driver_assignment',
        driverId: selectedDriver.driverId,
        orderId
      });

      return selectedDriver.driverId;
    } catch (error) {
      console.error('Auto-assignment error:', error);
      await realtimeAnalyticsService.trackEvent('driver_assignment_error', {
        orderId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async reassignDriver(orderId: number, excludeDriverId?: number): Promise<number | null> {
    try {
      // Get order details
      const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      
      if (!order || !order.pickupLocation) {
        throw new Error('Order not found or missing pickup location');
      }

      const pickupLocation = JSON.parse(order.pickupLocation);
      
      // Use stricter criteria for reassignment
      const reassignmentCriteria: AssignmentCriteria = {
        ...this.defaultCriteria,
        maxDistance: this.defaultCriteria.maxDistance * 1.5, // Expand search radius
        preferredRating: this.defaultCriteria.preferredRating - 0.5 // Lower rating threshold
      };

      const candidates = await this.findDriverCandidates(pickupLocation, reassignmentCriteria, excludeDriverId);
      
      if (candidates.length === 0) {
        await realtimeAnalyticsService.trackEvent('driver_reassignment_failed', {
          orderId,
          excludeDriverId,
          reason: 'no_candidates'
        });
        return null;
      }

      const selectedDriver = this.selectBestDriver(candidates);
      await this.performAssignment(orderId, selectedDriver.driverId);

      await realtimeAnalyticsService.trackEvent('driver_reassigned', {
        orderId,
        newDriverId: selectedDriver.driverId,
        previousDriverId: excludeDriverId,
        score: selectedDriver.score
      });

      return selectedDriver.driverId;
    } catch (error) {
      console.error('Driver reassignment error:', error);
      throw error;
    }
  }

  private async findDriverCandidates(
    location: Location,
    criteria: AssignmentCriteria,
    excludeDriverId?: number
  ): Promise<DriverCandidate[]> {
    try {
      // Build the query
      let whereConditions = [
        eq(drivers.isActive, true),
        or(isNull(drivers.isOnline), eq(drivers.isOnline, true))
      ];

      if (excludeDriverId) {
        whereConditions.push(ne(drivers.id, excludeDriverId));
      }

      // Get drivers with location and stats
      const driversWithLocation = await db.select({
        driverId: drivers.id,
        userId: drivers.userId,
        rating: drivers.rating,
        tier: drivers.tier,
        latitude: driverLocations.latitude,
        longitude: driverLocations.longitude,
        lastUpdated: driverLocations.lastUpdated
      })
      .from(drivers)
      .leftJoin(users, eq(drivers.userId, users.id))
      .leftJoin(driverLocations, eq(drivers.id, driverLocations.driverId))
      .where(and(...whereConditions));

      const candidates: DriverCandidate[] = [];

      for (const driver of driversWithLocation) {
        // Skip drivers without recent location updates
        if (!driver.latitude || !driver.longitude) continue;
        
        const locationAge = Date.now() - (driver.lastUpdated?.getTime() || 0);
        if (locationAge > 15 * 60 * 1000) continue; // Skip if location is older than 15 minutes

        // Calculate distance
        const distance = this.calculateDistance(
          location,
          { latitude: parseFloat(driver.latitude), longitude: parseFloat(driver.longitude) }
        );

        if (distance > criteria.maxDistance) continue;

        // Get active orders count
        const [activeOrdersResult] = await db.select({ count: sql<number>`COUNT(*)` })
          .from(orders)
          .where(and(
            eq(orders.driverId, driver.driverId),
            sql`status IN ('ASSIGNED', 'PICKED_UP', 'IN_TRANSIT')`
          ));

        const activeOrders = activeOrdersResult.count;
        
        if (activeOrders >= criteria.maxAssignments) continue;

        // Get last delivery time
        const [lastDeliveryResult] = await db.select({ lastDelivery: orders.updatedAt })
          .from(orders)
          .where(and(
            eq(orders.driverId, driver.driverId),
            eq(orders.status, 'DELIVERED')
          ))
          .orderBy(sql`updated_at DESC`)
          .limit(1);

        const candidate: DriverCandidate = {
          driverId: driver.driverId,
          userId: driver.userId,
          distance,
          rating: driver.rating || 0,
          activeOrders,
          tier: driver.tier || 'BRONZE',
          lastDelivery: lastDeliveryResult?.lastDelivery || null,
          score: 0
        };

        candidate.score = this.calculateDriverScore(candidate, criteria);
        candidates.push(candidate);
      }

      // Filter by minimum rating if specified
      return candidates
        .filter(candidate => candidate.rating >= criteria.preferredRating)
        .sort((a, b) => b.score - a.score);

    } catch (error) {
      console.error('Error finding driver candidates:', error);
      throw error;
    }
  }

  private calculateDriverScore(candidate: DriverCandidate, criteria: AssignmentCriteria): number {
    let score = 0;

    // Distance score (closer is better) - 40% weight
    const distanceScore = Math.max(0, (criteria.maxDistance - candidate.distance) / criteria.maxDistance) * 40;
    score += distanceScore;

    // Rating score - 25% weight
    const ratingScore = (candidate.rating / 5) * 25;
    score += ratingScore;

    // Workload score (fewer active orders is better) - 20% weight
    const workloadScore = Math.max(0, (criteria.maxAssignments - candidate.activeOrders) / criteria.maxAssignments) * 20;
    score += workloadScore;

    // Tier bonus - 10% weight
    if (criteria.considerTier) {
      const tierScores = { GOLD: 10, SILVER: 7, BRONZE: 4 };
      score += tierScores[candidate.tier as keyof typeof tierScores] || 0;
    }

    // Recency bonus (recent activity is good) - 5% weight
    if (candidate.lastDelivery) {
      const hoursSinceLastDelivery = (Date.now() - candidate.lastDelivery.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastDelivery < 24) {
        score += Math.max(0, (24 - hoursSinceLastDelivery) / 24) * 5;
      }
    }

    return Math.round(score * 100) / 100;
  }

  private selectBestDriver(candidates: DriverCandidate[]): DriverCandidate {
    // Add some randomization to prevent always selecting the same top driver
    const topCandidates = candidates.slice(0, Math.min(3, candidates.length));
    
    if (topCandidates.length === 1) {
      return topCandidates[0];
    }

    // Weighted random selection from top candidates
    const weights = topCandidates.map((candidate, index) => 
      Math.pow(2, topCandidates.length - index - 1)
    );
    
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const random = Math.random() * totalWeight;
    
    let weightSum = 0;
    for (let i = 0; i < topCandidates.length; i++) {
      weightSum += weights[i];
      if (random <= weightSum) {
        return topCandidates[i];
      }
    }

    return topCandidates[0];
  }

  private async performAssignment(orderId: number, driverId: number): Promise<void> {
    await db.update(orders)
      .set({
        driverId,
        status: 'ASSIGNED',
        updatedAt: new Date()
      })
      .where(eq(orders.id, orderId));
  }

  private calculateDistance(point1: Location, point2: Location): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(point2.latitude - point1.latitude);
    const dLon = this.toRadians(point2.longitude - point1.longitude);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(point1.latitude)) * Math.cos(this.toRadians(point2.latitude)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // Batch assignment for multiple orders
  async batchAssignDrivers(orderIds: number[]): Promise<Map<number, number | null>> {
    const assignments = new Map<number, number | null>();

    for (const orderId of orderIds) {
      try {
        const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
        
        if (order && order.pickupLocation) {
          const pickupLocation = JSON.parse(order.pickupLocation);
          const driverId = await this.assignDriver(orderId, pickupLocation);
          assignments.set(orderId, driverId);
        } else {
          assignments.set(orderId, null);
        }
      } catch (error) {
        console.error(`Failed to assign driver for order ${orderId}:`, error);
        assignments.set(orderId, null);
      }
    }

    return assignments;
  }

  // Get assignment statistics
  async getAssignmentStats(timeRange: { start: Date; end: Date }) {
    const [successfulAssignments, failedAssignments, avgAssignmentTime] = await Promise.all([
      db.select({ count: sql<number>`COUNT(*)` })
        .from(orders)
        .where(and(
          sql`driver_id IS NOT NULL`,
          sql`created_at BETWEEN ${timeRange.start} AND ${timeRange.end}`
        )),
      
      db.select({ count: sql<number>`COUNT(*)` })
        .from(orders)
        .where(and(
          sql`driver_id IS NULL`,
          sql`created_at BETWEEN ${timeRange.start} AND ${timeRange.end}`,
          sql`status = 'PENDING'`
        )),

      db.select({ 
        avgTime: sql<number>`AVG(EXTRACT(EPOCH FROM (updated_at - created_at)))`
      })
      .from(orders)
      .where(and(
        sql`driver_id IS NOT NULL`,
        sql`created_at BETWEEN ${timeRange.start} AND ${timeRange.end}`,
        sql`status = 'ASSIGNED'`
      ))
    ]);

    const totalOrders = successfulAssignments[0].count + failedAssignments[0].count;
    const successRate = totalOrders > 0 ? (successfulAssignments[0].count / totalOrders) * 100 : 0;

    return {
      totalOrders,
      successfulAssignments: successfulAssignments[0].count,
      failedAssignments: failedAssignments[0].count,
      successRate: Math.round(successRate * 100) / 100,
      avgAssignmentTimeSeconds: avgAssignmentTime[0].avgTime || 0
    };
  }
}

export const autoAssignmentService = new AutoAssignmentService();
export { AutoAssignmentService, AssignmentCriteria, DriverCandidate };
