"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("../schema");
const auth_1 = require("../utils/auth");
const database_1 = __importDefault(require("../config/database"));
const fraud_middleware_1 = require("../utils/fraud-middleware");
const router = (0, express_1.Router)();
// Admin-specific login endpoint
router.post('/login', (0, fraud_middleware_1.fraudDetectionMiddleware)('ADMIN_LOGIN'), async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        // Find user and verify they are an admin
        const user = await database_1.default.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.email, email));
        if (user.length === 0) {
            return res.status(401).json({ error: 'Invalid admin credentials' });
        }
        const foundUser = user[0];
        // Check if user has admin role
        if (foundUser.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
        }
        // Check password
        const isPasswordValid = await (0, auth_1.comparePassword)(password, foundUser.password || '');
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid admin credentials' });
        }
        if (!foundUser.isVerified) {
            return res.status(401).json({ error: 'Admin account not verified' });
        }
        // Generate JWT token with admin role
        const token = (0, auth_1.generateToken)({
            userId: foundUser.id,
            email: foundUser.email,
            role: 'ADMIN',
        });
        res.json({
            message: 'Admin login successful',
            token,
            admin: {
                id: foundUser.id,
                userId: foundUser.userId,
                fullName: foundUser.fullName,
                email: foundUser.email,
                role: foundUser.role,
                isVerified: foundUser.isVerified,
            },
            redirectTo: '/admin/dashboard', // Specific admin dashboard route
        });
    }
    catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Admin logout endpoint
router.post('/logout', async (req, res) => {
    try {
        // In a more advanced setup, you might want to blacklist the token
        res.json({
            message: 'Admin logged out successfully',
            redirectTo: '/admin/login'
        });
    }
    catch (error) {
        console.error('Admin logout error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Admin registration endpoint (for creating new admin users)
router.post('/register', async (req, res) => {
    try {
        const { fullName, email, phone, password, adminKey } = req.body;
        if (!fullName || !email || !phone || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        // Check admin registration key (add your secret key in environment)
        const ADMIN_REGISTRATION_KEY = process.env.ADMIN_REGISTRATION_KEY || 'BP_ADMIN_KEY_2024';
        if (adminKey !== ADMIN_REGISTRATION_KEY) {
            return res.status(403).json({ error: 'Invalid admin registration key' });
        }
        // Check if admin user already exists
        const existingUser = await database_1.default.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.email, email));
        if (existingUser.length > 0) {
            return res.status(400).json({ error: 'Admin user with this email already exists' });
        }
        // Generate unique admin user ID
        const userIdNumber = Math.floor(Math.random() * 900000) + 100000;
        const userId = `BP-ADMIN-${userIdNumber.toString().padStart(6, '0')}`;
        // Hash password
        const hashedPassword = await (0, auth_1.hashPassword)(password);
        // Create admin user
        const newAdmin = await database_1.default.insert(schema_1.users).values({
            userId,
            fullName,
            email,
            phone,
            password: hashedPassword,
            role: 'ADMIN',
            isVerified: true, // Auto-verify admin users
        }).returning();
        res.status(201).json({
            message: 'Admin user registered successfully',
            admin: {
                id: newAdmin[0].id,
                userId: newAdmin[0].userId,
                fullName: newAdmin[0].fullName,
                email: newAdmin[0].email,
                role: newAdmin[0].role,
            },
            redirectTo: '/admin/login'
        });
    }
    catch (error) {
        console.error('Admin registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Admin password reset (separate from regular users)
router.post('/reset-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        // Check if user exists and is an admin
        const user = await database_1.default.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.email, email));
        if (user.length === 0 || user[0].role !== 'ADMIN') {
            // Don't reveal if admin exists for security
            return res.json({ message: 'If an admin account with this email exists, a reset link will be sent.' });
        }
        // TODO: Implement admin-specific password reset logic
        // This could involve sending emails to a different template
        // or requiring additional verification steps
        res.json({ message: 'If an admin account with this email exists, a reset link will be sent.' });
    }
    catch (error) {
        console.error('Admin password reset error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
