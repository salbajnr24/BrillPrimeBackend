"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const database_1 = __importDefault(require("../config/database"));
const schema_1 = require("../schema");
const auth_1 = require("../utils/auth");
const auth_2 = require("../utils/auth");
const router = (0, express_1.Router)();
// Submit identity verification
router.post('/identity', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { faceImageUrl } = req.body;
        if (!faceImageUrl) {
            return res.status(400).json({ error: 'Face image URL is required' });
        }
        // Check if user already has a pending or approved verification
        const existingVerification = await database_1.default.select()
            .from(schema_1.identityVerifications)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.identityVerifications.userId, userId), (0, drizzle_orm_1.eq)(schema_1.identityVerifications.verificationStatus, 'PENDING')));
        if (existingVerification.length > 0) {
            return res.status(400).json({ error: 'Identity verification already submitted and pending review' });
        }
        const verification = await database_1.default.insert(schema_1.identityVerifications).values({
            userId,
            faceImageUrl,
            verificationStatus: 'PENDING',
        }).returning();
        res.status(201).json({
            message: 'Identity verification submitted successfully',
            verification: verification[0],
        });
    }
    catch (error) {
        console.error('Submit identity verification error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Submit driver verification
router.post('/driver', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('DRIVER'), async (req, res) => {
    try {
        const userId = req.user.userId;
        const { licenseNumber, licenseExpiryDate, licenseImageUrl, vehicleType, vehiclePlate, vehicleModel, vehicleYear, } = req.body;
        if (!licenseNumber || !licenseExpiryDate || !vehicleType || !vehiclePlate) {
            return res.status(400).json({
                error: 'Required fields: licenseNumber, licenseExpiryDate, vehicleType, vehiclePlate'
            });
        }
        // Check if user already has a pending or approved verification
        const existingVerification = await database_1.default.select()
            .from(schema_1.driverVerifications)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.driverVerifications.userId, userId), (0, drizzle_orm_1.eq)(schema_1.driverVerifications.verificationStatus, 'PENDING')));
        if (existingVerification.length > 0) {
            return res.status(400).json({ error: 'Driver verification already submitted and pending review' });
        }
        const verification = await database_1.default.insert(schema_1.driverVerifications).values({
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
    }
    catch (error) {
        console.error('Submit driver verification error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Submit phone verification
router.post('/phone', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { phoneNumber } = req.body;
        if (!phoneNumber) {
            return res.status(400).json({ error: 'Phone number is required' });
        }
        // Generate OTP
        const otp = (0, auth_2.generateOTP)();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        const verification = await database_1.default.insert(schema_1.phoneVerifications).values({
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
    }
    catch (error) {
        console.error('Submit phone verification error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Verify phone OTP
router.post('/phone/verify', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { verificationId, otpCode } = req.body;
        if (!verificationId || !otpCode) {
            return res.status(400).json({ error: 'Verification ID and OTP code are required' });
        }
        // Find the verification record
        const verification = await database_1.default.select()
            .from(schema_1.phoneVerifications)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.phoneVerifications.id, verificationId), (0, drizzle_orm_1.eq)(schema_1.phoneVerifications.userId, userId), (0, drizzle_orm_1.eq)(schema_1.phoneVerifications.otpCode, otpCode), (0, drizzle_orm_1.eq)(schema_1.phoneVerifications.isVerified, false)));
        if (verification.length === 0) {
            return res.status(400).json({ error: 'Invalid verification ID or OTP code' });
        }
        const verificationRecord = verification[0];
        // Check if OTP is expired
        if (new Date() > verificationRecord.expiresAt) {
            return res.status(400).json({ error: 'OTP has expired' });
        }
        // Mark verification as verified
        await database_1.default.update(schema_1.phoneVerifications)
            .set({ isVerified: true })
            .where((0, drizzle_orm_1.eq)(schema_1.phoneVerifications.id, verificationId));
        // Update user's phone verification status
        await database_1.default.update(schema_1.users)
            .set({
            isPhoneVerified: true,
            phone: verificationRecord.phoneNumber,
        })
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId));
        res.json({ message: 'Phone verification completed successfully' });
    }
    catch (error) {
        console.error('Verify phone OTP error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get verification status
router.get('/status', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        // Get all verification statuses
        const [identityVer, driverVer, phoneVer, user] = await Promise.all([
            database_1.default.select()
                .from(schema_1.identityVerifications)
                .where((0, drizzle_orm_1.eq)(schema_1.identityVerifications.userId, userId))
                .orderBy((0, drizzle_orm_1.desc)(schema_1.identityVerifications.createdAt))
                .limit(1),
            database_1.default.select()
                .from(schema_1.driverVerifications)
                .where((0, drizzle_orm_1.eq)(schema_1.driverVerifications.userId, userId))
                .orderBy((0, drizzle_orm_1.desc)(schema_1.driverVerifications.createdAt))
                .limit(1),
            database_1.default.select()
                .from(schema_1.phoneVerifications)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.phoneVerifications.userId, userId), (0, drizzle_orm_1.eq)(schema_1.phoneVerifications.isVerified, true)))
                .orderBy((0, drizzle_orm_1.desc)(schema_1.phoneVerifications.createdAt))
                .limit(1),
            database_1.default.select()
                .from(schema_1.users)
                .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId))
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
    }
    catch (error) {
        console.error('Get verification status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Admin: Approve identity verification
router.put('/admin/identity/:id/approve', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;
        const verificationId = Number(id);
        const verification = await database_1.default.select()
            .from(schema_1.identityVerifications)
            .where((0, drizzle_orm_1.eq)(schema_1.identityVerifications.id, verificationId));
        if (verification.length === 0) {
            return res.status(404).json({ error: 'Verification not found' });
        }
        const updatedVerification = await database_1.default.update(schema_1.identityVerifications)
            .set({
            verificationStatus: 'APPROVED',
            verificationDate: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_1.identityVerifications.id, verificationId))
            .returning();
        // Update user's identity verification status
        await database_1.default.update(schema_1.users)
            .set({ isIdentityVerified: true })
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, verification[0].userId));
        res.json({
            message: 'Identity verification approved',
            verification: updatedVerification[0],
        });
    }
    catch (error) {
        console.error('Approve identity verification error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Admin: Reject identity verification
router.put('/admin/identity/:id/reject', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;
        const verificationId = Number(id);
        const { rejectionReason } = req.body;
        if (!rejectionReason) {
            return res.status(400).json({ error: 'Rejection reason is required' });
        }
        const verification = await database_1.default.select()
            .from(schema_1.identityVerifications)
            .where((0, drizzle_orm_1.eq)(schema_1.identityVerifications.id, verificationId));
        if (verification.length === 0) {
            return res.status(404).json({ error: 'Verification not found' });
        }
        const updatedVerification = await database_1.default.update(schema_1.identityVerifications)
            .set({
            verificationStatus: 'REJECTED',
            verificationDate: new Date(),
            rejectionReason,
        })
            .where((0, drizzle_orm_1.eq)(schema_1.identityVerifications.id, verificationId))
            .returning();
        res.json({
            message: 'Identity verification rejected',
            verification: updatedVerification[0],
        });
    }
    catch (error) {
        console.error('Reject identity verification error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Admin: Approve driver verification
router.put('/admin/driver/:id/approve', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;
        const verificationId = Number(id);
        const verification = await database_1.default.select()
            .from(schema_1.driverVerifications)
            .where((0, drizzle_orm_1.eq)(schema_1.driverVerifications.id, verificationId));
        if (verification.length === 0) {
            return res.status(404).json({ error: 'Verification not found' });
        }
        const updatedVerification = await database_1.default.update(schema_1.driverVerifications)
            .set({
            verificationStatus: 'APPROVED',
            verificationDate: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_1.driverVerifications.id, verificationId))
            .returning();
        res.json({
            message: 'Driver verification approved',
            verification: updatedVerification[0],
        });
    }
    catch (error) {
        console.error('Approve driver verification error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Admin: Reject driver verification
router.put('/admin/driver/:id/reject', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;
        const verificationId = Number(id);
        const { rejectionReason } = req.body;
        if (!rejectionReason) {
            return res.status(400).json({ error: 'Rejection reason is required' });
        }
        const verification = await database_1.default.select()
            .from(schema_1.driverVerifications)
            .where((0, drizzle_orm_1.eq)(schema_1.driverVerifications.id, verificationId));
        if (verification.length === 0) {
            return res.status(404).json({ error: 'Verification not found' });
        }
        const updatedVerification = await database_1.default.update(schema_1.driverVerifications)
            .set({
            verificationStatus: 'REJECTED',
            verificationDate: new Date(),
            rejectionReason,
        })
            .where((0, drizzle_orm_1.eq)(schema_1.driverVerifications.id, verificationId))
            .returning();
        res.json({
            message: 'Driver verification rejected',
            verification: updatedVerification[0],
        });
    }
    catch (error) {
        console.error('Reject driver verification error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Admin: Get pending verifications
router.get('/admin/pending', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('ADMIN'), async (req, res) => {
    try {
        const { type, page = 1, limit = 20 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        let result = {};
        if (!type || type === 'identity') {
            const identityVers = await database_1.default.select({
                verification: schema_1.identityVerifications,
                user: {
                    id: schema_1.users.id,
                    fullName: schema_1.users.fullName,
                    email: schema_1.users.email,
                    phone: schema_1.users.phone,
                },
            })
                .from(schema_1.identityVerifications)
                .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.identityVerifications.userId, schema_1.users.id))
                .where((0, drizzle_orm_1.eq)(schema_1.identityVerifications.verificationStatus, 'PENDING'))
                .orderBy((0, drizzle_orm_1.desc)(schema_1.identityVerifications.createdAt))
                .limit(Number(limit))
                .offset(offset);
            result.identity = identityVers;
        }
        if (!type || type === 'driver') {
            const driverVers = await database_1.default.select({
                verification: schema_1.driverVerifications,
                user: {
                    id: schema_1.users.id,
                    fullName: schema_1.users.fullName,
                    email: schema_1.users.email,
                    phone: schema_1.users.phone,
                },
            })
                .from(schema_1.driverVerifications)
                .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.driverVerifications.userId, schema_1.users.id))
                .where((0, drizzle_orm_1.eq)(schema_1.driverVerifications.verificationStatus, 'PENDING'))
                .orderBy((0, drizzle_orm_1.desc)(schema_1.driverVerifications.createdAt))
                .limit(Number(limit))
                .offset(offset);
            result.driver = driverVers;
        }
        res.json(result);
    }
    catch (error) {
        console.error('Get pending verifications error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
