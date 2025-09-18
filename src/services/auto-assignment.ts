
import { db } from '../config/database';
import { orders, users } from '../schema';
import { eq, and, isNull, sql } from 'drizzle-orm';

interface DriverProfile {
  userId: number;
  rating: number;
  totalDeliveries: number;
  currentLatitude?: string;
  currentLongitude?: string;
  isOnline: boolean;
  isAvailable: boolean;
}

interface AssignmentCriteria {
  latitude: number;
  longitude: number;
  urgentOrder?: boolean;
  preferredDriverId?: number;
}

interface AssignmentResult {
  success: boolean;
  driverId?: number;
  distance?: number;
  driverScore?: number;
  assignedOrder?: any;
  error?: string;
}

export class AutoAssignmentService {
  private static readonly MAX_ASSIGNMENT_RADIUS = 15; // kilometers
  private static readonly URGENT_ORDER_RADIUS = 25; // kilometers for urgent orders

  static async assignBestDriver(
    orderId: number,
    criteria: AssignmentCriteria
  ): Promise<AssignmentResult | null> {
    try {
      // Get available drivers
      const availableDrivers = await this.getAvailableDrivers(criteria);
      
      if (availableDrivers.length === 0) {
        return null;
      }

      // Score and rank drivers
      const scoredDrivers = await this.scoreDrivers(availableDrivers, criteria);
      
      if (scoredDrivers.length === 0) {
        return null;
      }

      // Assign to best driver
      const bestDriver = scoredDrivers[0];
      const assignmentResult = await this.assignDriver(orderId, bestDriver.userId);

      if (assignmentResult.success) {
        return {
          success: true,
          driverId: bestDriver.userId,
          distance: bestDriver.distance,
          driverScore: bestDriver.score,
          assignedOrder: assignmentResult.order
        };
      }

      return null;
    } catch (error) {
      console.error('Auto-assignment error:', error);
      return {
        success: false,
        error: 'Assignment failed'
      };
    }
  }

  private static async getAvailableDrivers(criteria: AssignmentCriteria): Promise<DriverProfile[]> {
    // This would typically query a driver profiles table
    // For now, return mock data based on users with DRIVER role
    const drivers = await db
      .select({
        userId: users.id,
        email: users.email,
        fullName: users.fullName,
        role: users.role
      })
      .from(users)
      .where(eq(users.role, 'DRIVER'));

    // Convert to driver profiles (mock data)
    return drivers.map(driver => ({
      userId: driver.userId,
      rating: 4.5 + Math.random() * 0.5, // Mock rating 4.5-5.0
      totalDeliveries: Math.floor(Math.random() * 100) + 10,
      currentLatitude: (criteria.latitude + (Math.random() - 0.5) * 0.1).toString(),
      currentLongitude: (criteria.longitude + (Math.random() - 0.5) * 0.1).toString(),
      isOnline: Math.random() > 0.3, // 70% online
      isAvailable: Math.random() > 0.5 // 50% available
    })).filter(driver => driver.isOnline && driver.isAvailable);
  }

  private static async scoreDrivers(
    drivers: DriverProfile[],
    criteria: AssignmentCriteria
  ): Promise<Array<DriverProfile & { distance: number; score: number }>> {
    const maxRadius = criteria.urgentOrder ? 
      this.URGENT_ORDER_RADIUS : 
      this.MAX_ASSIGNMENT_RADIUS;

    const scoredDrivers = drivers
      .map(driver => {
        const distance = this.calculateDistance(
          criteria.latitude,
          criteria.longitude,
          parseFloat(driver.currentLatitude || '0'),
          parseFloat(driver.currentLongitude || '0')
        );

        if (distance > maxRadius) {
          return null;
        }

        // Calculate score based on multiple factors
        const distanceScore = Math.max(0, 1 - (distance / maxRadius)); // 0-1
        const ratingScore = driver.rating / 5; // 0-1
        const experienceScore = Math.min(1, driver.totalDeliveries / 100); // 0-1

        // Weighted score
        const score = (distanceScore * 0.4) + (ratingScore * 0.4) + (experienceScore * 0.2);

        return {
          ...driver,
          distance,
          score
        };
      })
      .filter((driver): driver is NonNullable<typeof driver> => driver !== null)
      .sort((a, b) => b.score - a.score);

    return scoredDrivers.slice(0, 5); // Return top 5 candidates
  }

  private static async assignDriver(orderId: number, driverId: number): Promise<{ success: boolean; order?: any }> {
    try {
      // Update order with assigned driver
      const [updatedOrder] = await db
        .update(orders)
        .set({
          driverId: driverId,
          status: 'ASSIGNED',
          acceptedAt: new Date(),
          updatedAt: new Date()
        })
        .where(and(
          eq(orders.id, orderId),
          isNull(orders.driverId) // Ensure order isn't already assigned
        ))
        .returning();

      if (updatedOrder) {
        // Send real-time notification to driver
        if (global.io) {
          global.io.to(`user_${driverId}`).emit('order_assigned', {
            orderId: updatedOrder.id,
            orderNumber: updatedOrder.orderNumber,
            assignedAt: new Date().toISOString()
          });
        }

        return { success: true, order: updatedOrder };
      }

      return { success: false };
    } catch (error) {
      console.error('Driver assignment error:', error);
      return { success: false };
    }
  }

  private static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  static async getDriverAvailability(driverId: number): Promise<boolean> {
    // Check if driver is available for new assignments
    try {
      const activeOrders = await db
        .select()
        .from(orders)
        .where(and(
          eq(orders.driverId, driverId),
          sql`status NOT IN ('DELIVERED', 'CANCELLED')`
        ));

      return activeOrders.length === 0;
    } catch (error) {
      console.error('Driver availability check error:', error);
      return false;
    }
  }
}
