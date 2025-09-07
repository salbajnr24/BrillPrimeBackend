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
const mailer_1 = require("../utils/mailer");
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
// Login endpoint
router.post('/login', async (req, res) => {
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
        const isPasswordValid = await (0, auth_1.comparePassword)(password, foundUser.password);
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
exports.default = router;
//# sourceMappingURL=auth.js.map