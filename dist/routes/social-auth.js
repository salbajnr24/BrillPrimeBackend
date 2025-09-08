"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const passport_1 = __importDefault(require("passport"));
const passport_google_oauth20_1 = require("passport-google-oauth20");
const passport_facebook_1 = require("passport-facebook");
const drizzle_orm_1 = require("drizzle-orm");
const database_1 = __importDefault(require("../config/database"));
const schema_1 = require("../schema");
const auth_1 = require("../utils/auth");
const mailer_1 = require("../utils/mailer");
const router = (0, express_1.Router)();
// Configure Google OAuth Strategy
passport_1.default.use(new passport_google_oauth20_1.Strategy({
    clientID: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackURL: "/api/social-auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // Check if user exists
        const existingUser = await database_1.default.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.email, profile.emails[0].value));
        if (existingUser.length > 0) {
            // User exists, return user
            return done(null, existingUser[0]);
        }
        // Create new user
        const userIdNumber = Math.floor(Math.random() * 900000) + 100000;
        const userId = `BP-${userIdNumber.toString().padStart(6, '0')}`;
        const newUser = await database_1.default.insert(schema_1.users).values({
            userId,
            fullName: profile.displayName || '',
            email: profile.emails[0].value,
            profilePicture: profile.photos[0].value,
            isVerified: true, // Auto-verify social auth users
            role: 'CONSUMER',
            socialAuth: {
                provider: 'google',
                providerId: profile.id
            }
        }).returning();
        await (0, mailer_1.sendWelcomeEmail)(newUser[0].email, newUser[0].fullName);
        return done(null, newUser[0]);
    }
    catch (error) {
        return done(error, null);
    }
}));
// Configure Facebook OAuth Strategy
passport_1.default.use(new passport_facebook_1.Strategy({
    clientID: process.env.FACEBOOK_APP_ID || '',
    clientSecret: process.env.FACEBOOK_APP_SECRET || '',
    callbackURL: "/api/social-auth/facebook/callback",
    profileFields: ['id', 'displayName', 'photos', 'email']
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const existingUser = await database_1.default.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.email, profile.emails[0].value));
        if (existingUser.length > 0) {
            return done(null, existingUser[0]);
        }
        const userIdNumber = Math.floor(Math.random() * 900000) + 100000;
        const userId = `BP-${userIdNumber.toString().padStart(6, '0')}`;
        const newUser = await database_1.default.insert(schema_1.users).values({
            userId,
            fullName: profile.displayName || '',
            email: profile.emails[0].value,
            profilePicture: profile.photos[0].value,
            isVerified: true,
            role: 'CONSUMER',
            socialAuth: {
                provider: 'facebook',
                providerId: profile.id
            }
        }).returning();
        await (0, mailer_1.sendWelcomeEmail)(newUser[0].email, newUser[0].fullName);
        return done(null, newUser[0]);
    }
    catch (error) {
        return done(error, null);
    }
}));
// Google OAuth routes
router.get('/google', passport_1.default.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport_1.default.authenticate('google', { session: false }), (req, res) => {
    const user = req.user;
    const token = (0, auth_1.generateToken)({
        userId: user.id,
        email: user.email,
        role: user.role
    });
    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3001'}/auth/callback?token=${token}`);
});
// Facebook OAuth routes
router.get('/facebook', passport_1.default.authenticate('facebook', { scope: ['email'] }));
router.get('/facebook/callback', passport_1.default.authenticate('facebook', { session: false }), (req, res) => {
    const user = req.user;
    const token = (0, auth_1.generateToken)({
        userId: user.id,
        email: user.email,
        role: user.role
    });
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3001'}/auth/callback?token=${token}`);
});
// Apple Sign-In endpoint (handled via JWT verification)
router.post('/apple', async (req, res) => {
    try {
        const { identityToken, user } = req.body;
        if (!identityToken) {
            return res.status(400).json({ error: 'Identity token is required' });
        }
        // Note: In production, you should verify the Apple JWT token
        // For now, we'll assume it's valid and extract user info
        const email = user?.email;
        const fullName = user?.name ? `${user.name.firstName} ${user.name.lastName}` : '';
        if (!email) {
            return res.status(400).json({ error: 'Email is required from Apple Sign-In' });
        }
        // Check if user exists
        const existingUser = await database_1.default.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.email, email));
        let userData;
        if (existingUser.length > 0) {
            userData = existingUser[0];
        }
        else {
            // Create new user
            const userIdNumber = Math.floor(Math.random() * 900000) + 100000;
            const userId = `BP-${userIdNumber.toString().padStart(6, '0')}`;
            const newUser = await database_1.default.insert(schema_1.users).values({
                userId,
                fullName,
                email,
                isVerified: true,
                role: 'CONSUMER',
                socialAuth: {
                    provider: 'apple',
                    providerId: user?.sub || email
                }
            }).returning();
            userData = newUser[0];
            await (0, mailer_1.sendWelcomeEmail)(userData.email, userData.fullName);
        }
        const token = (0, auth_1.generateToken)({
            userId: userData.id,
            email: userData.email,
            role: userData.role
        });
        res.json({
            message: 'Apple Sign-In successful',
            token,
            user: {
                id: userData.id,
                userId: userData.userId,
                fullName: userData.fullName,
                email: userData.email,
                role: userData.role,
                isVerified: userData.isVerified,
            }
        });
    }
    catch (error) {
        console.error('Apple Sign-In error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=social-auth.js.map