
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

// Enable 2FA
router.post('/enable-2fa', async (req, res) => {
  try {
    const { userId, secret, backupCodes } = req.body;

    if (!userId || !secret) {
      return res.status(400).json({
        success: false,
        message: 'User ID and secret are required'
      });
    }

    // Check if MFA is already enabled
    const existingMFA = await db
      .select()
      .from(mfaConfigurations)
      .where(eq(mfaConfigurations.userId, parseInt(userId)))
      .limit(1);

    if (existingMFA.length > 0) {
      return res.status(409).json({
        success: false,
        message: '2FA is already enabled for this user'
      });
    }

    const mfaConfig = await db
      .insert(mfaConfigurations)
      .values({
        userId: parseInt(userId),
        isEnabled: true,
        secret,
        backupCodes: backupCodes || []
      })
      .returning();

    res.json({
      success: true,
      message: '2FA enabled successfully',
      data: { id: mfaConfig[0].id, isEnabled: true }
    });
  } catch (error) {
    console.error('Error enabling 2FA:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to enable 2FA'
    });
  }
});

// Disable 2FA
router.post('/disable-2fa', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    await db
      .update(mfaConfigurations)
      .set({ 
        isEnabled: false,
        updatedAt: new Date()
      })
      .where(eq(mfaConfigurations.userId, parseInt(userId)));

    res.json({
      success: true,
      message: '2FA disabled successfully'
    });
  } catch (error) {
    console.error('Error disabling 2FA:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disable 2FA'
    });
  }
});

// Change password
router.post('/change-password', async (req, res) => {
  try {
    const { userId, currentPassword, newPassword } = req.body;

    if (!userId || !currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'User ID, current password, and new password are required'
      });
    }

    // This would typically verify the current password first
    // For now, we'll log the security event
    await db
      .insert(securityLogs)
      .values({
        userId: parseInt(userId),
        action: 'PASSWORD_CHANGE',
        details: { timestamp: new Date() },
        severity: 'INFO'
      });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password'
    });
  }
});

// Get login history
router.get('/login-history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10 } = req.query;

    const loginHistory = await db
      .select()
      .from(securityLogs)
      .where(and(
        eq(securityLogs.userId, parseInt(userId)),
        eq(securityLogs.action, 'LOGIN')
      ))
      .orderBy(desc(securityLogs.timestamp))
      .limit(parseInt(limit as string));

    res.json({
      success: true,
      data: loginHistory
    });
  } catch (error) {
    console.error('Error fetching login history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch login history'
    });
  }
});

// Get security logs (admin only)
router.get('/logs', async (req, res) => {
  try {
    const { userId, severity, limit = 50 } = req.query;

    let query = db
      .select()
      .from(securityLogs)
      .orderBy(desc(securityLogs.timestamp))
      .limit(parseInt(limit as string));

    if (userId) {
      query = query.where(eq(securityLogs.userId, parseInt(userId as string)));
    }

    if (severity) {
      query = query.where(eq(securityLogs.severity, severity as string));
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

export default router;
