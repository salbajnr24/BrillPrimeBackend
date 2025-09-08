"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const database_1 = __importDefault(require("../config/database"));
const schema_1 = require("../schema");
const auth_1 = require("../utils/auth");
const speakeasy = __importStar(require("speakeasy"));
const QRCode = __importStar(require("qrcode"));
const mailer_1 = require("../utils/mailer");
const fraud_middleware_1 = require("../utils/fraud-middleware");
const router = (0, express_1.Router)();
// Register endpoint
router.post('/register', async (req, res) => {
    try {
        const { fullName, email, phone, password, role } = req.body;
        if (!fullName || !email || !phone || !password || !role) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        if (!['CONSUMER', 'MERCHANT', 'DRIVER'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }
        // Check if user already exists
        const existingUser = await database_1.default.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.email, email));
        if (existingUser.length > 0) {
            return res.status(400).json({ error: 'User with this email already exists' });
        }
        // Generate unique user ID
        const userIdNumber = Math.floor(Math.random() * 900000) + 100000;
        const userId = `BP-${userIdNumber.toString().padStart(6, '0')}`;
        // Hash password
        const hashedPassword = await (0, auth_1.hashPassword)(password);
        // Create user
        const newUser = await database_1.default.insert(schema_1.users).values({
            userId,
            fullName,
            email,
            phone,
            password: hashedPassword,
            role: role,
        }).returning();
        // Generate and send OTP
        const otp = (0, auth_1.generateOTP)();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        await database_1.default.insert(schema_1.otpCodes).values({
            email,
            code: otp,
            expiresAt,
        });
        await (0, mailer_1.sendOTPEmail)(email, otp);
        res.status(201).json({
            message: 'User registered successfully. Please verify your email with the OTP sent.',
            userId: newUser[0].id,
        });
    }
    catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Verify OTP endpoint
router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ error: 'Email and OTP are required' });
        }
        // Find valid OTP
        const otpRecord = await database_1.default.select()
            .from(schema_1.otpCodes)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.otpCodes.email, email), (0, drizzle_orm_1.eq)(schema_1.otpCodes.code, otp), (0, drizzle_orm_1.eq)(schema_1.otpCodes.isUsed, false)));
        if (otpRecord.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }
        const otp_record = otpRecord[0];
        // Check if OTP is expired
        if (new Date() > otp_record.expiresAt) {
            return res.status(400).json({ error: 'OTP has expired' });
        }
        // Mark OTP as used
        await database_1.default.update(schema_1.otpCodes)
            .set({ isUsed: true })
            .where((0, drizzle_orm_1.eq)(schema_1.otpCodes.id, otp_record.id));
        // Verify user
        const user = await database_1.default.update(schema_1.users)
            .set({ isVerified: true })
            .where((0, drizzle_orm_1.eq)(schema_1.users.email, email))
            .returning();
        if (user.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Send welcome email
        await (0, mailer_1.sendWelcomeEmail)(email, user[0].fullName);
        // Generate JWT token
        const token = (0, auth_1.generateToken)({
            userId: user[0].id,
            email: user[0].email,
            role: user[0].role,
        });
        res.json({
            message: 'Email verified successfully',
            token,
            user: {
                id: user[0].id,
                userId: user[0].userId,
                fullName: user[0].fullName,
                email: user[0].email,
                role: user[0].role,
                isVerified: user[0].isVerified,
            },
        });
    }
    catch (error) {
        console.error('OTP verification error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Login user
router.post('/login', (0, fraud_middleware_1.fraudDetectionMiddleware)('LOGIN'), async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        // Find user
        const user = await database_1.default.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.email, email));
        if (user.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const foundUser = user[0];
        // Check password
        const isPasswordValid = await (0, auth_1.comparePassword)(password, foundUser.password || '');
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        if (!foundUser.isVerified) {
            return res.status(401).json({ error: 'Please verify your email first' });
        }
        // Generate JWT token
        const token = (0, auth_1.generateToken)({
            userId: foundUser.id,
            email: foundUser.email,
            role: foundUser.role,
        });
        res.json({
            message: 'Login successful',
            token,
            user: {
                id: foundUser.id,
                userId: foundUser.userId,
                fullName: foundUser.fullName,
                email: foundUser.email,
                role: foundUser.role,
                isVerified: foundUser.isVerified,
            },
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Resend OTP endpoint
router.post('/resend-otp', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        // Check if user exists
        const user = await database_1.default.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.email, email));
        if (user.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (user[0].isVerified) {
            return res.status(400).json({ error: 'User is already verified' });
        }
        // Generate new OTP
        const otp = (0, auth_1.generateOTP)();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        await database_1.default.insert(schema_1.otpCodes).values({
            email,
            code: otp,
            expiresAt,
        });
        await (0, mailer_1.sendOTPEmail)(email, otp);
        res.json({ message: 'OTP sent successfully' });
    }
    catch (error) {
        console.error('Resend OTP error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Forgot password endpoint
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        // Check if user exists
        const user = await database_1.default.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.email, email));
        if (user.length === 0) {
            // Don't reveal if user exists or not for security
            return res.json({ message: 'If an account with this email exists, a reset link will be sent.' });
        }
        // Generate reset OTP
        const resetOTP = (0, auth_1.generateOTP)();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        await database_1.default.insert(schema_1.otpCodes).values({
            email,
            code: resetOTP,
            expiresAt,
        });
        // Send reset OTP email
        await (0, mailer_1.sendOTPEmail)(email, resetOTP);
        res.json({ message: 'If an account with this email exists, a reset link will be sent.' });
    }
    catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Reset password endpoint
router.post('/reset-password', async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        if (!email || !otp || !newPassword) {
            return res.status(400).json({ error: 'Email, OTP, and new password are required' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }
        // Find valid OTP
        const otpRecord = await database_1.default.select()
            .from(schema_1.otpCodes)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.otpCodes.email, email), (0, drizzle_orm_1.eq)(schema_1.otpCodes.code, otp), (0, drizzle_orm_1.eq)(schema_1.otpCodes.isUsed, false)));
        if (otpRecord.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }
        const otp_record = otpRecord[0];
        // Check if OTP is expired
        if (new Date() > otp_record.expiresAt) {
            return res.status(400).json({ error: 'OTP has expired' });
        }
        // Hash new password
        const hashedPassword = await (0, auth_1.hashPassword)(newPassword);
        // Update user password
        const updatedUser = await database_1.default.update(schema_1.users)
            .set({ password: hashedPassword })
            .where((0, drizzle_orm_1.eq)(schema_1.users.email, email))
            .returning();
        if (updatedUser.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Mark OTP as used
        await database_1.default.update(schema_1.otpCodes)
            .set({ isUsed: true })
            .where((0, drizzle_orm_1.eq)(schema_1.otpCodes.id, otp_record.id));
        res.json({ message: 'Password reset successfully' });
    }
    catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Change password (while logged in)
router.put('/change-password', auth_1.authenticateToken, (0, fraud_middleware_1.fraudDetectionMiddleware)('PASSWORD_CHANGE'), async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.userId;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current password and new password are required' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters long' });
        }
        // Get user
        const user = await database_1.default.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId));
        if (user.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const foundUser = user[0];
        // Verify current password
        const isCurrentPasswordValid = await (0, auth_1.comparePassword)(currentPassword, foundUser.password || '');
        if (!isCurrentPasswordValid) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }
        // Hash new password
        const hashedNewPassword = await (0, auth_1.hashPassword)(newPassword);
        // Update password
        await database_1.default.update(schema_1.users)
            .set({ password: hashedNewPassword })
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId));
        res.json({ message: 'Password changed successfully' });
    }
    catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Initiate MFA setup endpoint
router.post('/initiate-mfa', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        // Get user info for generating QR code
        const user = await database_1.default.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId));
        if (user.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const foundUser = user[0];
        // Check if MFA is already enabled
        const existingMfa = await database_1.default.select().from(schema_1.mfaConfigurations).where((0, drizzle_orm_1.eq)(schema_1.mfaConfigurations.userId, userId));
        if (existingMfa.length > 0 && existingMfa[0].isEnabled) {
            return res.status(400).json({ error: 'MFA is already enabled for this account' });
        }
        // Generate new secret
        const secret = speakeasy.generateSecret({
            name: `BrillPrime (${foundUser.email})`,
            issuer: 'BrillPrime',
            length: 32
        });
        const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
        // Store secret (not yet enabled)
        if (existingMfa.length > 0) {
            await database_1.default.update(schema_1.mfaConfigurations)
                .set({ secret: secret.base32, isEnabled: false, updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(schema_1.mfaConfigurations.userId, userId));
        }
        else {
            await database_1.default.insert(schema_1.mfaConfigurations).values({
                userId,
                secret: secret.base32,
                isEnabled: false
            });
        }
        res.json({
            secret: secret.base32,
            qrCode: qrCodeUrl,
            manualEntryKey: secret.base32,
            message: 'Scan the QR code with your authenticator app, then verify with setup-mfa endpoint'
        });
    }
    catch (error) {
        console.error('Initiate MFA error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Complete MFA setup endpoint
router.post('/setup-mfa', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { token } = req.body;
        // Get user info for generating QR code
        const user = await database_1.default.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId));
        if (user.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const foundUser = user[0];
        if (!token) {
            // Generate new secret and return QR code for setup
            const secret = speakeasy.generateSecret({
                name: `BrillPrime (${foundUser.email})`,
                issuer: 'BrillPrime',
                length: 32
            });
            const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
            return res.json({
                secret: secret.base32,
                qrCode: qrCodeUrl,
                manualEntryKey: secret.base32,
                message: 'Scan the QR code with your authenticator app and verify with a token'
            });
        }
        // Verify the token to complete setup
        const existingMfa = await database_1.default.select().from(schema_1.mfaConfigurations).where((0, drizzle_orm_1.eq)(schema_1.mfaConfigurations.userId, userId));
        if (existingMfa.length === 0) {
            return res.status(400).json({ error: 'No MFA setup in progress. Please start setup first.' });
        }
        const verified = speakeasy.totp.verify({
            secret: existingMfa[0].secret,
            encoding: 'base32',
            token,
            window: 2
        });
        if (!verified) {
            return res.status(400).json({ error: 'Invalid MFA token' });
        }
        // Generate backup codes
        const backupCodes = Array.from({ length: 8 }, () => Math.random().toString(36).substring(2, 10).toUpperCase());
        // Enable MFA
        await database_1.default.update(schema_1.mfaConfigurations)
            .set({
            isEnabled: true,
            backupCodes,
            updatedAt: new Date()
        })
            .where((0, drizzle_orm_1.eq)(schema_1.mfaConfigurations.userId, userId));
        res.json({
            message: 'MFA setup completed successfully',
            backupCodes
        });
    }
    catch (error) {
        console.error('Setup MFA error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Verify MFA endpoint
router.post('/verify-mfa', async (req, res) => {
    try {
        const { email, password, mfaToken } = req.body;
        if (!email || !password || !mfaToken) {
            return res.status(400).json({ error: 'Email, password, and MFA token are required' });
        }
        // Find user
        const user = await database_1.default.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.email, email));
        if (user.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const foundUser = user[0];
        // Check password
        const isPasswordValid = await (0, auth_1.comparePassword)(password, foundUser.password || '');
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        if (!foundUser.isVerified) {
            return res.status(401).json({ error: 'Please verify your email first' });
        }
        // Check if user has MFA enabled
        const mfaConfig = await database_1.default.select().from(schema_1.mfaConfigurations).where((0, drizzle_orm_1.eq)(schema_1.mfaConfigurations.userId, foundUser.id));
        if (mfaConfig.length === 0 || !mfaConfig[0].isEnabled) {
            return res.status(400).json({ error: 'MFA is not enabled for this account' });
        }
        const mfa = mfaConfig[0];
        // Verify TOTP token
        const verified = speakeasy.totp.verify({
            secret: mfa.secret,
            encoding: 'base32',
            token: mfaToken,
            window: 2
        });
        // Check backup codes if TOTP fails
        let isBackupCode = false;
        if (!verified && mfa.backupCodes && mfa.backupCodes.includes(mfaToken)) {
            isBackupCode = true;
            // Remove used backup code
            const updatedBackupCodes = mfa.backupCodes.filter(code => code !== mfaToken);
            await database_1.default.update(schema_1.mfaConfigurations)
                .set({
                backupCodes: updatedBackupCodes,
                lastUsedAt: new Date()
            })
                .where((0, drizzle_orm_1.eq)(schema_1.mfaConfigurations.userId, foundUser.id));
        }
        if (!verified && !isBackupCode) {
            return res.status(400).json({ error: 'Invalid MFA token or backup code' });
        }
        // Update last used timestamp
        if (verified) {
            await database_1.default.update(schema_1.mfaConfigurations)
                .set({ lastUsedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(schema_1.mfaConfigurations.userId, foundUser.id));
        }
        // Generate JWT token
        const token = (0, auth_1.generateToken)({
            userId: foundUser.id,
            email: foundUser.email,
            role: foundUser.role,
        });
        res.json({
            message: 'MFA verification successful',
            token,
            user: {
                id: foundUser.id,
                userId: foundUser.userId,
                fullName: foundUser.fullName,
                email: foundUser.email,
                role: foundUser.role,
                isVerified: foundUser.isVerified,
            },
            usedBackupCode: isBackupCode
        });
    }
    catch (error) {
        console.error('Verify MFA error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Disable MFA endpoint
router.post('/disable-mfa', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { password, mfaToken } = req.body;
        if (!password || !mfaToken) {
            return res.status(400).json({ error: 'Password and MFA token are required' });
        }
        // Get user
        const user = await database_1.default.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId));
        if (user.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const foundUser = user[0];
        // Verify current password
        const isPasswordValid = await (0, auth_1.comparePassword)(password, foundUser.password || '');
        if (!isPasswordValid) {
            return res.status(400).json({ error: 'Invalid password' });
        }
        // Check if user has MFA enabled
        const mfaConfig = await database_1.default.select().from(schema_1.mfaConfigurations).where((0, drizzle_orm_1.eq)(schema_1.mfaConfigurations.userId, userId));
        if (mfaConfig.length === 0 || !mfaConfig[0].isEnabled) {
            return res.status(400).json({ error: 'MFA is not enabled for this account' });
        }
        const mfa = mfaConfig[0];
        // Verify TOTP token or backup code
        const verified = speakeasy.totp.verify({
            secret: mfa.secret,
            encoding: 'base32',
            token: mfaToken,
            window: 2
        });
        const isBackupCode = mfa.backupCodes && mfa.backupCodes.includes(mfaToken);
        if (!verified && !isBackupCode) {
            return res.status(400).json({ error: 'Invalid MFA token or backup code' });
        }
        // Disable MFA
        await database_1.default.update(schema_1.mfaConfigurations)
            .set({
            isEnabled: false,
            backupCodes: [],
            updatedAt: new Date()
        })
            .where((0, drizzle_orm_1.eq)(schema_1.mfaConfigurations.userId, userId));
        res.json({ message: 'MFA disabled successfully' });
    }
    catch (error) {
        console.error('Disable MFA error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get MFA status endpoint
router.get('/mfa-status', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const mfaConfig = await database_1.default.select().from(schema_1.mfaConfigurations).where((0, drizzle_orm_1.eq)(schema_1.mfaConfigurations.userId, userId));
        const isEnabled = mfaConfig.length > 0 && mfaConfig[0].isEnabled;
        const backupCodesCount = isEnabled && mfaConfig[0].backupCodes ? mfaConfig[0].backupCodes.length : 0;
        res.json({
            mfaEnabled: isEnabled,
            backupCodesRemaining: backupCodesCount,
            lastUsed: isEnabled ? mfaConfig[0].lastUsedAt : null
        });
    }
    catch (error) {
        console.error('Get MFA status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Report User endpoint
router.post('/api/report/user/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const reportedUserId = req.params.id;
        const { reason } = req.body;
        const reportingUserId = req.user.userId;
        if (!reason) {
            return res.status(400).json({ error: 'Reason for reporting is required' });
        }
        // TODO: Implement actual reporting logic (e.g., saving to database, flagging user)
        console.log(`User ${reportingUserId} reported user ${reportedUserId} for reason: ${reason}`);
        res.status(200).json({ message: 'User reported successfully' });
    }
    catch (error) {
        console.error('Report user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Report Product endpoint
router.post('/api/report/product/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const reportedProductId = req.params.id;
        const { reason } = req.body;
        const reportingUserId = req.user.userId;
        if (!reason) {
            return res.status(400).json({ error: 'Reason for reporting is required' });
        }
        // TODO: Implement actual reporting logic (e.g., saving to database, flagging product)
        console.log(`User ${reportingUserId} reported product ${reportedProductId} for reason: ${reason}`);
        res.status(200).json({ message: 'Product reported successfully' });
    }
    catch (error) {
        console.error('Report product error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map