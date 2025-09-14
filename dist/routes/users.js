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
        let finalQuery = query;
        if (search) {
            finalQuery = database_1.default.select({
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
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.users.role, 'MERCHANT'), (0, drizzle_orm_1.eq)(schema_1.users.isVerified, true), (0, drizzle_orm_1.like)(schema_1.users.fullName, `%${search}%`)))
                .orderBy((0, drizzle_orm_1.desc)(schema_1.merchantProfiles.rating))
                .limit(Number(limit))
                .offset(offset);
        }
        const merchants = await finalQuery;
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
// Switch user role
router.put('/role', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { role } = req.body;
        // Validate role
        const validRoles = ['CONSUMER', 'MERCHANT', 'DRIVER'];
        if (!role || !validRoles.includes(role)) {
            return res.status(400).json({
                error: 'Invalid role. Must be one of: CONSUMER, MERCHANT, DRIVER'
            });
        }
        // Get current user to check existing role
        const currentUser = await database_1.default.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId));
        if (currentUser.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Update user role
        const updatedUser = await database_1.default.update(schema_1.users)
            .set({ role: role })
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId))
            .returning();
        // Check if switching to MERCHANT and create profile if not exists
        if (role === 'MERCHANT') {
            const existingMerchantProfile = await database_1.default.select()
                .from(schema_1.merchantProfiles)
                .where((0, drizzle_orm_1.eq)(schema_1.merchantProfiles.userId, userId));
            if (existingMerchantProfile.length === 0) {
                await database_1.default.insert(schema_1.merchantProfiles).values({
                    userId,
                    businessName: updatedUser[0].fullName + "'s Business",
                    businessType: 'OTHER',
                    businessDescription: 'New merchant profile',
                });
            }
        }
        // Check if switching to DRIVER and create profile if not exists
        if (role === 'DRIVER') {
            const existingDriverProfile = await database_1.default.select()
                .from(schema_1.driverProfiles)
                .where((0, drizzle_orm_1.eq)(schema_1.driverProfiles.userId, userId));
            if (existingDriverProfile.length === 0) {
                await database_1.default.insert(schema_1.driverProfiles).values({
                    userId,
                    vehicleType: 'MOTORCYCLE',
                    vehiclePlate: 'PENDING',
                    driverLicense: 'PENDING',
                });
            }
        }
        res.json({
            message: `Role switched to ${role} successfully`,
            user: {
                id: updatedUser[0].id,
                userId: updatedUser[0].userId,
                fullName: updatedUser[0].fullName,
                email: updatedUser[0].email,
                role: updatedUser[0].role,
                previousRole: currentUser[0].role,
            },
        });
    }
    catch (error) {
        console.error('Switch role error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Public user search (minimal information)
router.get('/search', async (req, res) => {
    try {
        const { q: query, type, page = 1, limit = 10 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        if (!query || typeof query !== 'string' || query.trim().length < 2) {
            return res.status(400).json({
                error: 'Query parameter "q" is required and must be at least 2 characters'
            });
        }
        const searchTerm = `%${query.trim()}%`;
        let whereConditions = [
            (0, drizzle_orm_1.eq)(schema_1.users.isVerified, true),
        ];
        // Add search conditions
        whereConditions.push((0, drizzle_orm_1.or)((0, drizzle_orm_1.like)(schema_1.users.fullName, searchTerm), (0, drizzle_orm_1.like)(schema_1.users.email, searchTerm)));
        // Filter by user type if specified
        if (type && ['CONSUMER', 'MERCHANT', 'DRIVER'].includes(type)) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.users.role, type));
        }
        // Base user query
        let userQuery = database_1.default.select({
            id: schema_1.users.id,
            userId: schema_1.users.userId,
            fullName: schema_1.users.fullName,
            email: schema_1.users.email,
            role: schema_1.users.role,
            profilePicture: schema_1.users.profilePicture,
            city: schema_1.users.city,
            state: schema_1.users.state,
            isVerified: schema_1.users.isVerified,
            createdAt: schema_1.users.createdAt,
        })
            .from(schema_1.users)
            .where((0, drizzle_orm_1.and)(...whereConditions))
            .limit(Number(limit))
            .offset(offset);
        const searchResults = await userQuery;
        // For merchants, get additional business info
        const merchantIds = searchResults
            .filter(user => user.role === 'MERCHANT')
            .map(user => user.id);
        let merchantProfilesData = [];
        if (merchantIds.length > 0) {
            merchantProfilesData = await database_1.default.select({
                userId: schema_1.merchantProfiles.userId,
                businessName: schema_1.merchantProfiles.businessName,
                businessType: schema_1.merchantProfiles.businessType,
                rating: schema_1.merchantProfiles.rating,
                reviewCount: schema_1.merchantProfiles.reviewCount,
                isVerified: schema_1.merchantProfiles.isVerified,
            })
                .from(schema_1.merchantProfiles)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.sql) `${schema_1.merchantProfiles.userId} IN (${merchantIds.join(',')})`, (0, drizzle_orm_1.like)(schema_1.merchantProfiles.businessName, searchTerm)));
        }
        // Combine results
        const enhancedResults = searchResults.map(user => {
            const result = {
                id: user.id,
                userId: user.userId,
                fullName: user.fullName,
                role: user.role,
                profilePicture: user.profilePicture,
                city: user.city,
                state: user.state,
                isVerified: user.isVerified,
                createdAt: user.createdAt,
            };
            // Add merchant info if applicable
            if (user.role === 'MERCHANT') {
                const merchantProfile = merchantProfilesData.find(mp => mp.userId === user.id);
                if (merchantProfile) {
                    result.merchantInfo = {
                        businessName: merchantProfile.businessName,
                        businessType: merchantProfile.businessType,
                        rating: merchantProfile.rating,
                        reviewCount: merchantProfile.reviewCount,
                        isVerified: merchantProfile.isVerified,
                    };
                }
            }
            return result;
        });
        res.json({
            results: enhancedResults,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: searchResults.length,
                hasMore: searchResults.length === Number(limit),
            },
            searchQuery: query,
            searchType: type || 'ALL',
        });
    }
    catch (error) {
        console.error('User search error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
