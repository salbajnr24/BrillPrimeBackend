
import { eq, and, gte, desc, sql } from 'drizzle-orm';
import db from '../config/database';
import { fraudAlerts, userActivities, blacklistedEntities, users } from '../schema';

export interface FraudCheckResult {
  isRisky: boolean;
  riskScore: number;
  alerts: string[];
  shouldBlock: boolean;
}

export interface ActivityData {
  userId: number;
  activityType: string;
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  location?: {
    country?: string;
    city?: string;
    lat?: number;
    lng?: number;
  };
  sessionId?: string;
  metadata?: any;
}

export class FraudDetection {
  private static readonly RISK_THRESHOLDS = {
    LOW: 30,
    MEDIUM: 60,
    HIGH: 80,
    CRITICAL: 95,
  };

  private static readonly VELOCITY_LIMITS = {
    LOGIN: { count: 10, windowMinutes: 60 },
    PAYMENT: { count: 5, windowMinutes: 30 },
    ORDER_PLACE: { count: 20, windowMinutes: 60 },
    WITHDRAWAL: { count: 3, windowMinutes: 120 },
  };

  static async checkActivity(activityData: ActivityData): Promise<FraudCheckResult> {
    const checks = [
      this.checkBlacklist(activityData),
      this.checkVelocity(activityData),
      this.checkLocationAnomaly(activityData),
      this.checkDeviceAnomaly(activityData),
      this.checkUserBehavior(activityData),
    ];

    const results = await Promise.all(checks);
    const alerts: string[] = [];
    let totalRiskScore = 0;

    results.forEach(result => {
      totalRiskScore += result.riskScore;
      alerts.push(...result.alerts);
    });

    const finalRiskScore = Math.min(totalRiskScore, 100);
    const shouldBlock = finalRiskScore >= this.RISK_THRESHOLDS.CRITICAL;
    const isRisky = finalRiskScore >= this.RISK_THRESHOLDS.MEDIUM;

    // Log the activity
    await this.logActivity({
      ...activityData,
      riskScore: finalRiskScore,
      flagged: isRisky,
    });

    // Create fraud alert if risky
    if (isRisky) {
      await this.createFraudAlert(activityData, finalRiskScore, alerts);
    }

    return {
      isRisky,
      riskScore: finalRiskScore,
      alerts,
      shouldBlock,
    };
  }

  private static async checkBlacklist(data: ActivityData): Promise<{ riskScore: number; alerts: string[] }> {
    const alerts: string[] = [];
    let riskScore = 0;

    if (data.ipAddress) {
      const ipBlacklisted = await db.select()
        .from(blacklistedEntities)
        .where(and(
          eq(blacklistedEntities.entityType, 'IP'),
          eq(blacklistedEntities.entityValue, data.ipAddress),
          eq(blacklistedEntities.isActive, true)
        ))
        .limit(1);

      if (ipBlacklisted.length > 0) {
        riskScore += 50;
        alerts.push('IP address is blacklisted');
      }
    }

    if (data.deviceFingerprint) {
      const deviceBlacklisted = await db.select()
        .from(blacklistedEntities)
        .where(and(
          eq(blacklistedEntities.entityType, 'DEVICE'),
          eq(blacklistedEntities.entityValue, data.deviceFingerprint),
          eq(blacklistedEntities.isActive, true)
        ))
        .limit(1);

      if (deviceBlacklisted.length > 0) {
        riskScore += 40;
        alerts.push('Device is blacklisted');
      }
    }

    return { riskScore, alerts };
  }

  private static async checkVelocity(data: ActivityData): Promise<{ riskScore: number; alerts: string[] }> {
    const alerts: string[] = [];
    let riskScore = 0;

    const limit = this.VELOCITY_LIMITS[data.activityType as keyof typeof this.VELOCITY_LIMITS];
    if (!limit) return { riskScore, alerts };

    const windowStart = new Date();
    windowStart.setMinutes(windowStart.getMinutes() - limit.windowMinutes);

    const recentActivities = await db.select()
      .from(userActivities)
      .where(and(
        eq(userActivities.userId, data.userId),
        eq(userActivities.activityType, data.activityType),
        gte(userActivities.createdAt, windowStart)
      ));

    if (recentActivities.length >= limit.count) {
      riskScore += 30;
      alerts.push(`High velocity: ${recentActivities.length} ${data.activityType} activities in ${limit.windowMinutes} minutes`);
    }

    return { riskScore, alerts };
  }

  private static async checkLocationAnomaly(data: ActivityData): Promise<{ riskScore: number; alerts: string[] }> {
    const alerts: string[] = [];
    let riskScore = 0;

    if (!data.location) return { riskScore, alerts };

    // Get user's recent locations
    const recentActivities = await db.select()
      .from(userActivities)
      .where(eq(userActivities.userId, data.userId))
      .orderBy(desc(userActivities.createdAt))
      .limit(10);

    const recentLocations = recentActivities
      .map(activity => activity.location as any)
      .filter(location => location && location.country);

    if (recentLocations.length > 0) {
      const mostRecentLocation = recentLocations[0];
      
      // Check for impossible travel (different countries in short time)
      if (mostRecentLocation.country !== data.location.country) {
        const timeDiff = new Date().getTime() - new Date(recentActivities[0].createdAt!).getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);
        
        if (hoursDiff < 12) { // Less than 12 hours for international travel
          riskScore += 25;
          alerts.push(`Impossible travel detected: ${mostRecentLocation.country} to ${data.location.country} in ${hoursDiff.toFixed(1)} hours`);
        }
      }
    }

    return { riskScore, alerts };
  }

  private static async checkDeviceAnomaly(data: ActivityData): Promise<{ riskScore: number; alerts: string[] }> {
    const alerts: string[] = [];
    let riskScore = 0;

    if (!data.deviceFingerprint && !data.userAgent) return { riskScore, alerts };

    // Get user's recent devices
    const recentActivities = await db.select()
      .from(userActivities)
      .where(eq(userActivities.userId, data.userId))
      .orderBy(desc(userActivities.createdAt))
      .limit(20);

    const knownDevices = new Set(recentActivities.map(a => a.deviceFingerprint).filter(Boolean));
    const knownUserAgents = new Set(recentActivities.map(a => a.userAgent).filter(Boolean));

    if (data.deviceFingerprint && !knownDevices.has(data.deviceFingerprint)) {
      riskScore += 15;
      alerts.push('New device detected');
    }

    if (data.userAgent && !knownUserAgents.has(data.userAgent)) {
      riskScore += 10;
      alerts.push('New user agent detected');
    }

    return { riskScore, alerts };
  }

  private static async checkUserBehavior(data: ActivityData): Promise<{ riskScore: number; alerts: string[] }> {
    const alerts: string[] = [];
    let riskScore = 0;

    // Check if user has been flagged recently
    const recentFlags = await db.select()
      .from(userActivities)
      .where(and(
        eq(userActivities.userId, data.userId),
        eq(userActivities.flagged, true),
        gte(userActivities.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) // Last 7 days
      ));

    if (recentFlags.length > 0) {
      riskScore += recentFlags.length * 5;
      alerts.push(`User has ${recentFlags.length} flagged activities in the last 7 days`);
    }

    return { riskScore, alerts };
  }

  private static async logActivity(data: ActivityData & { riskScore: number; flagged: boolean }): Promise<void> {
    await db.insert(userActivities).values({
      userId: data.userId,
      activityType: data.activityType,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      deviceFingerprint: data.deviceFingerprint,
      location: data.location,
      sessionId: data.sessionId,
      riskScore: data.riskScore.toString(),
      flagged: data.flagged,
      metadata: data.metadata,
    });
  }

  private static async createFraudAlert(
    data: ActivityData,
    riskScore: number,
    alerts: string[]
  ): Promise<void> {
    let alertType = 'SUSPICIOUS_ACTIVITY';
    let severity = 'MEDIUM';

    if (riskScore >= this.RISK_THRESHOLDS.CRITICAL) {
      severity = 'CRITICAL';
    } else if (riskScore >= this.RISK_THRESHOLDS.HIGH) {
      severity = 'HIGH';
    } else if (riskScore < this.RISK_THRESHOLDS.MEDIUM) {
      severity = 'LOW';
    }

    // Determine alert type based on activity and alerts
    if (data.activityType === 'PAYMENT' && alerts.some(a => a.includes('mismatch'))) {
      alertType = 'PAYMENT_MISMATCH';
    } else if (alerts.some(a => a.includes('velocity'))) {
      alertType = 'VELOCITY_CHECK';
    } else if (alerts.some(a => a.includes('travel'))) {
      alertType = 'IP_CHANGE';
    } else if (alerts.some(a => a.includes('device'))) {
      alertType = 'DEVICE_CHANGE';
    }

    await db.insert(fraudAlerts).values({
      userId: data.userId,
      alertType: alertType as any,
      severity: severity as any,
      description: alerts.join('; '),
      metadata: {
        activityType: data.activityType,
        riskScore,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        location: data.location,
        ...data.metadata,
      },
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      riskScore: riskScore.toString(),
    });
  }

  static async addToBlacklist(
    entityType: string,
    entityValue: string,
    reason: string,
    addedBy: number,
    expiresAt?: Date
  ): Promise<void> {
    await db.insert(blacklistedEntities).values({
      entityType: entityType as any,
      entityValue,
      reason,
      addedBy,
      expiresAt,
    });
  }

  static async checkPaymentMismatch(
    userId: number,
    expectedAmount: number,
    actualAmount: number,
    paymentMethod: string,
    metadata?: any
  ): Promise<void> {
    if (Math.abs(expectedAmount - actualAmount) > 0.01) {
      await db.insert(fraudAlerts).values({
        userId,
        alertType: 'PAYMENT_MISMATCH',
        severity: 'HIGH',
        description: `Payment amount mismatch: expected ${expectedAmount}, received ${actualAmount}`,
        metadata: {
          expectedAmount,
          actualAmount,
          paymentMethod,
          difference: Math.abs(expectedAmount - actualAmount),
          ...metadata,
        },
        riskScore: '75',
      });
    }
  }
}
