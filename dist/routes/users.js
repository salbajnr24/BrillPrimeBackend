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
const router = (0, express_1.Router)();
// Get user profile
router.get('/profile', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await database_1.default.select({
            id: schema_1.users.id,
            userId: schema_1.users.userId,
            fullName: schema_1.users.fullName,
            email: schema_1.users.email,
            phone: schema_1.users.phone,
            role: schema_1.users.role,
            isVerified: schema_1.users.isVerified,
            isPhoneVerified: schema_1.users.isPhoneVerified,
            isIdentityVerified: schema_1.users.isIdentityVerified,
            profilePicture: schema_1.users.profilePicture,
            address: schema_1.users.address,
            city: schema_1.users.city,
            state: schema_1.users.state,
            country: schema_1.users.country,
            bio: schema_1.users.bio,
            createdAt: schema_1.users.createdAt,
        }).from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId));
        if (user.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user[0]);
    }
    catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Update user profile
router.put('/profile', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { fullName, phone, address, city, state, country, bio, profilePicture } = req.body;
        const updatedUser = await database_1.default.update(schema_1.users)
            .set({
            fullName,
            phone,
            address,
            city,
            state,
            country,
            bio,
            profilePicture,
        })
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId))
            .returning();
        if (updatedUser.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            message: 'Profile updated successfully',
            user: {
                id: updatedUser[0].id,
                userId: updatedUser[0].userId,
                fullName: updatedUser[0].fullName,
                email: updatedUser[0].email,
                phone: updatedUser[0].phone,
                role: updatedUser[0].role,
                address: updatedUser[0].address,
                city: updatedUser[0].city,
                state: updatedUser[0].state,
                country: updatedUser[0].country,
                bio: updatedUser[0].bio,
                profilePicture: updatedUser[0].profilePicture,
            },
        });
    }
    catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get all merchants (public)
router.get('/merchants', async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        let query = database_1.default.select({
            id: schema_1.users.id,
            userId: schema_1.users.userId,
            fullName: schema_1.users.fullName,
            email: schema_1.users.email,
            profilePicture: schema_1.users.profilePicture,
            city: schema_1.users.city,
            state: schema_1.users.state,
            isVerified: schema_1.users.isVerified,
            merchantProfile: {
                businessName: schema_1.merchantProfiles.businessName,
                businessType: schema_1.merchantProfiles.businessType,
                businessDescription: schema_1.merchantProfiles.businessDescription,
                businessLogo: schema_1.merchantProfiles.businessLogo,
                rating: schema_1.merchantProfiles.rating,
                reviewCount: schema_1.merchantProfiles.reviewCount,
                totalSales: schema_1.merchantProfiles.totalSales,
                totalOrders: schema_1.merchantProfiles.totalOrders,
                isVerified: schema_1.merchantProfiles.isVerified,
                subscriptionTier: schema_1.merchantProfiles.subscriptionTier,
            },
        })
            .from(schema_1.users)
            .leftJoin(schema_1.merchantProfiles, (0, drizzle_orm_1.eq)(schema_1.users.id, schema_1.merchantProfiles.userId))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.users.role, 'MERCHANT'), (0, drizzle_orm_1.eq)(schema_1.users.isVerified, true)))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.merchantProfiles.rating))
            .limit(Number(limit))
            .offset(offset);
        if (search) {
            query = query.where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.users.role, 'MERCHANT'), (0, drizzle_orm_1.eq)(schema_1.users.isVerified, true), (0, drizzle_orm_1.like)(schema_1.users.fullName, `%${search}%`)));
        }
        const merchants = await query;
        res.json({
            merchants,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: merchants.length,
            },
        });
    }
    catch (error) {
        console.error('Get merchants error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get merchant details by ID
router.get('/merchants/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const merchant = await database_1.default.select({
            id: schema_1.users.id,
            userId: schema_1.users.userId,
            fullName: schema_1.users.fullName,
            email: schema_1.users.email,
            phone: schema_1.users.phone,
            profilePicture: schema_1.users.profilePicture,
            address: schema_1.users.address,
            city: schema_1.users.city,
            state: schema_1.users.state,
            country: schema_1.users.country,
            bio: schema_1.users.bio,
            createdAt: schema_1.users.createdAt,
            merchantProfile: schema_1.merchantProfiles,
        })
            .from(schema_1.users)
            .leftJoin(schema_1.merchantProfiles, (0, drizzle_orm_1.eq)(schema_1.users.id, schema_1.merchantProfiles.userId))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.users.id, Number(id)), (0, drizzle_orm_1.eq)(schema_1.users.role, 'MERCHANT'), (0, drizzle_orm_1.eq)(schema_1.users.isVerified, true)));
        if (merchant.length === 0) {
            return res.status(404).json({ error: 'Merchant not found' });
        }
        res.json(merchant[0]);
    }
    catch (error) {
        console.error('Get merchant details error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Update merchant profile
router.put('/merchant-profile', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('MERCHANT'), async (req, res) => {
    try {
        const userId = req.user.userId;
        const { businessName, businessType, businessDescription, businessAddress, businessPhone, businessEmail, businessLogo, businessHours, } = req.body;
        // Check if merchant profile exists
        const existingProfile = await database_1.default.select().from(schema_1.merchantProfiles).where((0, drizzle_orm_1.eq)(schema_1.merchantProfiles.userId, userId));
        let profile;
        if (existingProfile.length === 0) {
            // Create new profile
            profile = await database_1.default.insert(schema_1.merchantProfiles).values({
                userId,
                businessName,
                businessType,
                businessDescription,
                businessAddress,
                businessPhone,
                businessEmail,
                businessLogo,
                businessHours,
            }).returning();
        }
        else {
            // Update existing profile
            profile = await database_1.default.update(schema_1.merchantProfiles)
                .set({
                businessName,
                businessType,
                businessDescription,
                businessAddress,
                businessPhone,
                businessEmail,
                businessLogo,
                businessHours,
            })
                .where((0, drizzle_orm_1.eq)(schema_1.merchantProfiles.userId, userId))
                .returning();
        }
        res.json({
            message: 'Merchant profile updated successfully',
            profile: profile[0],
        });
    }
    catch (error) {
        console.error('Update merchant profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Update driver profile
router.put('/driver-profile', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('DRIVER'), async (req, res) => {
    try {
        const userId = req.user.userId;
        const { driverTier, accessLevel, vehicleType, vehiclePlate, vehicleModel, vehicleYear, driverLicense, vehicleDocuments, serviceTypes, specializations, } = req.body;
        // Check if driver profile exists
        const existingProfile = await database_1.default.select().from(schema_1.driverProfiles).where((0, drizzle_orm_1.eq)(schema_1.driverProfiles.userId, userId));
        let profile;
        if (existingProfile.length === 0) {
            // Create new profile
            profile = await database_1.default.insert(schema_1.driverProfiles).values({
                userId,
                driverTier,
                accessLevel,
                vehicleType,
                vehiclePlate,
                vehicleModel,
                vehicleYear,
                driverLicense,
                vehicleDocuments,
                serviceTypes,
                specializations,
            }).returning();
        }
        else {
            // Update existing profile
            profile = await database_1.default.update(schema_1.driverProfiles)
                .set({
                driverTier,
                accessLevel,
                vehicleType,
                vehiclePlate,
                vehicleModel,
                vehicleYear,
                driverLicense,
                vehicleDocuments,
                serviceTypes,
                specializations,
            })
                .where((0, drizzle_orm_1.eq)(schema_1.driverProfiles.userId, userId))
                .returning();
        }
        res.json({
            message: 'Driver profile updated successfully',
            profile: profile[0],
        });
    }
    catch (error) {
        console.error('Update driver profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Update user location
router.post('/location', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { latitude, longitude, address } = req.body;
        if (!latitude || !longitude) {
            return res.status(400).json({ error: 'Latitude and longitude are required' });
        }
        // Deactivate previous locations
        await database_1.default.update(schema_1.userLocations)
            .set({ isActive: false })
            .where((0, drizzle_orm_1.eq)(schema_1.userLocations.userId, userId));
        // Insert new location
        const location = await database_1.default.insert(schema_1.userLocations).values({
            userId,
            latitude: latitude.toString(),
            longitude: longitude.toString(),
            address,
            isActive: true,
        }).returning();
        res.json({
            message: 'Location updated successfully',
            location: location[0],
        });
    }
    catch (error) {
        console.error('Update location error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=users.js.map