
import { Router } from 'express';
import { db } from '../config/database';
import { securityLogs, suspiciousActivities, trustedDevices } from '../schema';
import { eq, desc, and } from 'drizzle-orm';

const router = Router();

// Log security event
router.post('/log', async (req, res) => {
  try {
    const { userId, action, details, ipAddress, userAgent, severity = 'INFO' } = req.body;

    const securityLog = await db
      .insert(securityLogs)
      .values({
        userId: userId ? parseInt(userId) : null,
        action,
        details,
        ipAddress,
        userAgent,
        severity
      })
      .returning();

    res.json({
      success: true,
      data: securityLog[0]
    });
  } catch (error) {
    console.error('Error logging security event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log security event'
    });
  }
});

// Get security logs for user
router.get('/logs/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, severity } = req.query;

    let query = db
      .select()
      .from(securityLogs)
      .where(eq(securityLogs.userId, parseInt(userId)))
      .orderBy(desc(securityLogs.timestamp))
      .limit(parseInt(limit as string));

    if (severity) {
      query = query.where(and(
        eq(securityLogs.userId, parseInt(userId)),
        eq(securityLogs.severity, severity as string)
      ));
    }

    const logs = await query;

    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('Error fetching security logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch security logs'
    });
  }
});

// Report suspicious activity
router.post('/suspicious', async (req, res) => {
  try {
    const { 
      userId, 
      activityType, 
      description, 
      riskIndicators, 
      ipAddress, 
      deviceFingerprint,
      severity = 'MEDIUM' 
    } = req.body;

    const suspiciousActivity = await db
      .insert(suspiciousActivities)
      .values({
        userId: userId ? parseInt(userId) : null,
        activityType,
        description,
        riskIndicators,
        ipAddress,
        deviceFingerprint,
        severity
      })
      .returning();

    res.json({
      success: true,
      message: 'Suspicious activity reported',
      data: suspiciousActivity[0]
    });
  } catch (error) {
    console.error('Error reporting suspicious activity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to report suspicious activity'
    });
  }
});

// Manage trusted devices
router.post('/trusted-device', async (req, res) => {
  try {
    const { 
      userId, 
      deviceToken, 
      deviceName, 
      deviceType, 
      browserInfo,
      expiresAt 
    } = req.body;

    const trustedDevice = await db
      .insert(trustedDevices)
      .values({
        userId: parseInt(userId),
        deviceToken,
        deviceName,
        deviceType,
        browserInfo,
        expiresAt: new Date(expiresAt),
        lastUsedAt: new Date()
      })
      .returning();

    res.json({
      success: true,
      message: 'Trusted device added',
      data: trustedDevice[0]
    });
  } catch (error) {
    console.error('Error adding trusted device:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add trusted device'
    });
  }
});

export default router;
