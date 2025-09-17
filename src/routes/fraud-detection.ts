
import { Router } from 'express';
import { eq, and, or, desc, gte, lte, count, inArray, sql } from 'drizzle-orm';
import db from '../config/database';
import { users, transactions, fraudAlerts, suspiciousActivities, accountFlags } from '../schema';
import { authenticateToken, authorizeRoles } from '../utils/auth';

const router = Router();

// Get fraud alerts with filtering
router.get('/alerts', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { severity, status, type, search, startDate, endDate, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let whereConditions = [];

    if (severity) whereConditions.push(eq(fraudAlerts.severity, severity as string));
    if (status) whereConditions.push(eq(fraudAlerts.status, status as string));
    if (type) whereConditions.push(eq(fraudAlerts.type, type as string));
    if (startDate) whereConditions.push(gte(fraudAlerts.detectedAt, new Date(startDate as string)));
    if (endDate) whereConditions.push(lte(fraudAlerts.detectedAt, new Date(endDate as string)));

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const alerts = await db
      .select({
        id: fraudAlerts.id,
        userId: fraudAlerts.userId,
        type: fraudAlerts.type,
        severity: fraudAlerts.severity,
        status: fraudAlerts.status,
        title: fraudAlerts.title,
        description: fraudAlerts.description,
        riskScore: fraudAlerts.riskScore,
        metadata: fraudAlerts.metadata,
        detectedAt: fraudAlerts.detectedAt,
        resolvedAt: fraudAlerts.resolvedAt,
        user: {
          id: users.id,
          fullName: users.fullName,
          email: users.email,
          role: users.role
        }
      })
      .from(fraudAlerts)
      .innerJoin(users, eq(fraudAlerts.userId, users.id))
      .where(whereClause)
      .orderBy(desc(fraudAlerts.detectedAt))
      .limit(parseInt(limit as string))
      .offset(offset);

    res.json({ 
      success: true, 
      data: alerts,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: alerts.length
      }
    });
  } catch (error) {
    console.error('Error fetching fraud alerts:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch fraud alerts' });
  }
});

// Get fraud statistics
router.get('/stats', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalAlerts] = await db
      .select({ count: count() })
      .from(fraudAlerts)
      .where(eq(fraudAlerts.status, 'ACTIVE'));

    const [criticalAlerts] = await db
      .select({ count: count() })
      .from(fraudAlerts)
      .where(and(
        eq(fraudAlerts.severity, 'CRITICAL'),
        eq(fraudAlerts.status, 'ACTIVE')
      ));

    const [resolvedToday] = await db
      .select({ count: count() })
      .from(fraudAlerts)
      .where(and(
        eq(fraudAlerts.status, 'RESOLVED'),
        gte(fraudAlerts.resolvedAt, today)
      ));

    const [flaggedAccounts] = await db
      .select({ count: count() })
      .from(accountFlags)
      .where(eq(accountFlags.status, 'ACTIVE'));

    const stats = {
      totalAlerts: totalAlerts.count,
      criticalAlerts: criticalAlerts.count,
      resolvedToday: resolvedToday.count,
      flaggedAccounts: flaggedAccounts.count,
      falsePositiveRate: 5.2, // Mock data - would be calculated
      avgResolutionTime: 2.5, // Mock data - would be calculated
      blockedTransactions: 15, // Mock data - would come from transaction monitoring
      totalRiskReduction: 250000 // Mock data - calculated based on prevented fraud
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching fraud stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch fraud statistics' });
  }
});

// Get suspicious activities
router.get('/activities', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const activities = await db
      .select({
        id: suspiciousActivities.id,
        userId: suspiciousActivities.userId,
        activityType: suspiciousActivities.activityType,
        description: suspiciousActivities.description,
        riskIndicators: suspiciousActivities.riskIndicators,
        timestamp: suspiciousActivities.timestamp,
        ipAddress: suspiciousActivities.ipAddress,
        deviceFingerprint: suspiciousActivities.deviceFingerprint,
        user: {
          fullName: users.fullName,
          email: users.email
        }
      })
      .from(suspiciousActivities)
      .innerJoin(users, eq(suspiciousActivities.userId, users.id))
      .orderBy(desc(suspiciousActivities.timestamp))
      .limit(50);

    res.json({ success: true, data: activities });
  } catch (error) {
    console.error('Error fetching suspicious activities:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch suspicious activities' });
  }
});

// Investigate alert
router.post('/alerts/:alertId/investigate', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { alertId } = req.params;
    const { reason } = req.body;

    await db
      .update(fraudAlerts)
      .set({
        status: 'INVESTIGATING',
        updatedAt: new Date()
      })
      .where(eq(fraudAlerts.id, parseInt(alertId)));

    res.json({ success: true, message: 'Alert marked as investigating' });
  } catch (error) {
    console.error('Error updating alert:', error);
    res.status(500).json({ success: false, message: 'Failed to update alert' });
  }
});

// Resolve alert
router.post('/alerts/:alertId/resolve', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { alertId } = req.params;
    const { reason } = req.body;
    const adminId = (req as any).user.id;

    await db
      .update(fraudAlerts)
      .set({
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedBy: adminId,
        updatedAt: new Date()
      })
      .where(eq(fraudAlerts.id, parseInt(alertId)));

    res.json({ success: true, message: 'Alert resolved successfully' });
  } catch (error) {
    console.error('Error resolving alert:', error);
    res.status(500).json({ success: false, message: 'Failed to resolve alert' });
  }
});

// Flag user account
router.post('/users/:userId/flag', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason, severity = 'HIGH' } = req.body;
    const adminId = (req as any).user.id;

    await db.insert(accountFlags).values({
      userId: parseInt(userId),
      flagType: 'FRAUD_RISK',
      severity: severity,
      reason: reason || 'Flagged due to fraud alert',
      flaggedBy: adminId,
      status: 'ACTIVE',
      createdAt: new Date()
    });

    res.json({ success: true, message: 'User account flagged successfully' });
  } catch (error) {
    console.error('Error flagging user:', error);
    res.status(500).json({ success: false, message: 'Failed to flag user account' });
  }
});

// Bulk actions on alerts
router.post('/alerts/bulk-action', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { alertIds, action, reason } = req.body;
    const adminId = (req as any).user.id;

    if (!Array.isArray(alertIds) || alertIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid alert IDs' });
    }

    const updateData: any = {
      updatedAt: new Date()
    };

    switch (action) {
      case 'investigate':
        updateData.status = 'INVESTIGATING';
        break;
      case 'resolve':
        updateData.status = 'RESOLVED';
        updateData.resolvedAt = new Date();
        updateData.resolvedBy = adminId;
        break;
      case 'false_positive':
        updateData.status = 'FALSE_POSITIVE';
        updateData.resolvedAt = new Date();
        updateData.resolvedBy = adminId;
        break;
      default:
        return res.status(400).json({ success: false, message: 'Invalid action' });
    }

    await db
      .update(fraudAlerts)
      .set(updateData)
      .where(inArray(fraudAlerts.id, alertIds));

    res.json({ success: true, message: `Bulk ${action} completed successfully` });
  } catch (error) {
    console.error('Error performing bulk action:', error);
    res.status(500).json({ success: false, message: 'Failed to perform bulk action' });
  }
});

export default router;
