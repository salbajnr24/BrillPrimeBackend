import { Router } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import db from '../config/database';
import { identityVerifications, driverVerifications, phoneVerifications, users } from '../schema';
import { authenticateToken, authorizeRoles } from '../utils/auth';
import { generateOTP } from '../utils/auth';
import { sendOTPEmail } from '../utils/mailer';

const router = Router();

// Submit identity verification
router.post('/identity', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { faceImageUrl } = req.body;

    if (!faceImageUrl) {
      return res.status(400).json({ error: 'Face image URL is required' });
    }

    // Check if user already has a pending or approved verification
    const existingVerification = await db.select()
      .from(identityVerifications)
      .where(and(
        eq(identityVerifications.userId, userId),
        eq(identityVerifications.verificationStatus, 'PENDING')
      ));

    if (existingVerification.length > 0) {
      return res.status(400).json({ error: 'Identity verification already submitted and pending review' });
    }

    const verification = await db.insert(identityVerifications).values({
      userId,
      faceImageUrl,
      verificationStatus: 'PENDING',
    }).returning();

    res.status(201).json({
      message: 'Identity verification submitted successfully',
      verification: verification[0],
    });
  } catch (error) {
    console.error('Submit identity verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Submit driver verification
router.post('/driver', authenticateToken, authorizeRoles('DRIVER'), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const {
      licenseNumber,
      licenseExpiryDate,
      licenseImageUrl,
      vehicleType,
      vehiclePlate,
      vehicleModel,
      vehicleYear,
    } = req.body;

    if (!licenseNumber || !licenseExpiryDate || !vehicleType || !vehiclePlate) {
      return res.status(400).json({ 
        error: 'Required fields: licenseNumber, licenseExpiryDate, vehicleType, vehiclePlate' 
      });
    }

    // Check if user already has a pending or approved verification
    const existingVerification = await db.select()
      .from(driverVerifications)
      .where(and(
        eq(driverVerifications.userId, userId),
        eq(driverVerifications.verificationStatus, 'PENDING')
      ));

    if (existingVerification.length > 0) {
      return res.status(400).json({ error: 'Driver verification already submitted and pending review' });
    }

    const verification = await db.insert(driverVerifications).values({
      userId,
      licenseNumber,
      licenseExpiryDate,
      licenseImageUrl,
      vehicleType,
      vehiclePlate,
      vehicleModel,
      vehicleYear,
      verificationStatus: 'PENDING',
    }).returning();

    res.status(201).json({
      message: 'Driver verification submitted successfully',
      verification: verification[0],
    });
  } catch (error) {
    console.error('Submit driver verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Submit phone verification
router.post('/phone', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const verification = await db.insert(phoneVerifications).values({
      userId,
      phoneNumber,
      otpCode: otp,
      expiresAt,
    }).returning();

    // In a real application, you would send SMS OTP here
    // For now, we'll just return success (you can integrate with SMS service)
    console.log(`SMS OTP for ${phoneNumber}: ${otp}`);

    res.status(201).json({
      message: 'Phone verification OTP sent successfully',
      verificationId: verification[0].id,
    });
  } catch (error) {
    console.error('Submit phone verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify phone OTP
router.post('/phone/verify', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { verificationId, otpCode } = req.body;

    if (!verificationId || !otpCode) {
      return res.status(400).json({ error: 'Verification ID and OTP code are required' });
    }

    // Find the verification record
    const verification = await db.select()
      .from(phoneVerifications)
      .where(and(
        eq(phoneVerifications.id, verificationId),
        eq(phoneVerifications.userId, userId),
        eq(phoneVerifications.otpCode, otpCode),
        eq(phoneVerifications.isVerified, false)
      ));

    if (verification.length === 0) {
      return res.status(400).json({ error: 'Invalid verification ID or OTP code' });
    }

    const verificationRecord = verification[0];

    // Check if OTP is expired
    if (new Date() > verificationRecord.expiresAt) {
      return res.status(400).json({ error: 'OTP has expired' });
    }

    // Mark verification as verified
    await db.update(phoneVerifications)
      .set({ isVerified: true })
      .where(eq(phoneVerifications.id, verificationId));

    // Update user's phone verification status
    await db.update(users)
      .set({ 
        isPhoneVerified: true,
        phone: verificationRecord.phoneNumber,
      })
      .where(eq(users.id, userId));

    res.json({ message: 'Phone verification completed successfully' });
  } catch (error) {
    console.error('Verify phone OTP error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get verification status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    // Get all verification statuses
    const [identityVer, driverVer, phoneVer, user] = await Promise.all([
      db.select()
        .from(identityVerifications)
        .where(eq(identityVerifications.userId, userId))
        .orderBy(desc(identityVerifications.createdAt))
        .limit(1),
      
      db.select()
        .from(driverVerifications)
        .where(eq(driverVerifications.userId, userId))
        .orderBy(desc(driverVerifications.createdAt))
        .limit(1),
      
      db.select()
        .from(phoneVerifications)
        .where(and(
          eq(phoneVerifications.userId, userId),
          eq(phoneVerifications.isVerified, true)
        ))
        .orderBy(desc(phoneVerifications.createdAt))
        .limit(1),
      
      db.select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1),
    ]);

    const userRecord = user[0];

    res.json({
      user: {
        isVerified: userRecord?.isVerified || false,
        isPhoneVerified: userRecord?.isPhoneVerified || false,
        isIdentityVerified: userRecord?.isIdentityVerified || false,
      },
      identity: {
        status: identityVer[0]?.verificationStatus || 'NOT_SUBMITTED',
        submittedAt: identityVer[0]?.createdAt || null,
        verifiedAt: identityVer[0]?.verificationDate || null,
        rejectionReason: identityVer[0]?.rejectionReason || null,
      },
      driver: {
        status: driverVer[0]?.verificationStatus || 'NOT_SUBMITTED',
        submittedAt: driverVer[0]?.createdAt || null,
        verifiedAt: driverVer[0]?.verificationDate || null,
        rejectionReason: driverVer[0]?.rejectionReason || null,
      },
      phone: {
        isVerified: phoneVer.length > 0,
        verifiedAt: phoneVer[0]?.createdAt || null,
      },
    });
  } catch (error) {
    console.error('Get verification status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Approve identity verification
router.put('/admin/identity/:id/approve', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const verificationId = Number(id);

    const verification = await db.select()
      .from(identityVerifications)
      .where(eq(identityVerifications.id, verificationId));

    if (verification.length === 0) {
      return res.status(404).json({ error: 'Verification not found' });
    }

    const updatedVerification = await db.update(identityVerifications)
      .set({
        verificationStatus: 'APPROVED',
        verificationDate: new Date(),
      })
      .where(eq(identityVerifications.id, verificationId))
      .returning();

    // Update user's identity verification status
    await db.update(users)
      .set({ isIdentityVerified: true })
      .where(eq(users.id, verification[0].userId));

    res.json({
      message: 'Identity verification approved',
      verification: updatedVerification[0],
    });
  } catch (error) {
    console.error('Approve identity verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Reject identity verification
router.put('/admin/identity/:id/reject', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const verificationId = Number(id);
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const verification = await db.select()
      .from(identityVerifications)
      .where(eq(identityVerifications.id, verificationId));

    if (verification.length === 0) {
      return res.status(404).json({ error: 'Verification not found' });
    }

    const updatedVerification = await db.update(identityVerifications)
      .set({
        verificationStatus: 'REJECTED',
        verificationDate: new Date(),
        rejectionReason,
      })
      .where(eq(identityVerifications.id, verificationId))
      .returning();

    res.json({
      message: 'Identity verification rejected',
      verification: updatedVerification[0],
    });
  } catch (error) {
    console.error('Reject identity verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Approve driver verification
router.put('/admin/driver/:id/approve', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const verificationId = Number(id);

    const verification = await db.select()
      .from(driverVerifications)
      .where(eq(driverVerifications.id, verificationId));

    if (verification.length === 0) {
      return res.status(404).json({ error: 'Verification not found' });
    }

    const updatedVerification = await db.update(driverVerifications)
      .set({
        verificationStatus: 'APPROVED',
        verificationDate: new Date(),
      })
      .where(eq(driverVerifications.id, verificationId))
      .returning();

    res.json({
      message: 'Driver verification approved',
      verification: updatedVerification[0],
    });
  } catch (error) {
    console.error('Approve driver verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Reject driver verification
router.put('/admin/driver/:id/reject', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const verificationId = Number(id);
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const verification = await db.select()
      .from(driverVerifications)
      .where(eq(driverVerifications.id, verificationId));

    if (verification.length === 0) {
      return res.status(404).json({ error: 'Verification not found' });
    }

    const updatedVerification = await db.update(driverVerifications)
      .set({
        verificationStatus: 'REJECTED',
        verificationDate: new Date(),
        rejectionReason,
      })
      .where(eq(driverVerifications.id, verificationId))
      .returning();

    res.json({
      message: 'Driver verification rejected',
      verification: updatedVerification[0],
    });
  } catch (error) {
    console.error('Reject driver verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Get pending verifications
router.get('/admin/pending', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { type, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let result: any = {};

    if (!type || type === 'identity') {
      const identityVers = await db.select({
        verification: identityVerifications,
        user: {
          id: users.id,
          fullName: users.fullName,
          email: users.email,
          phone: users.phone,
        },
      })
        .from(identityVerifications)
        .leftJoin(users, eq(identityVerifications.userId, users.id))
        .where(eq(identityVerifications.verificationStatus, 'PENDING'))
        .orderBy(desc(identityVerifications.createdAt))
        .limit(Number(limit))
        .offset(offset);

      result.identity = identityVers;
    }

    if (!type || type === 'driver') {
      const driverVers = await db.select({
        verification: driverVerifications,
        user: {
          id: users.id,
          fullName: users.fullName,
          email: users.email,
          phone: users.phone,
        },
      })
        .from(driverVerifications)
        .leftJoin(users, eq(driverVerifications.userId, users.id))
        .where(eq(driverVerifications.verificationStatus, 'PENDING'))
        .orderBy(desc(driverVerifications.createdAt))
        .limit(Number(limit))
        .offset(offset);

      result.driver = driverVers;
    }

    res.json(result);
  } catch (error) {
    console.error('Get pending verifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;