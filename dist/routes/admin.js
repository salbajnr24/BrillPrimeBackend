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
// Admin dashboard endpoint
router.get('/dashboard', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('ADMIN'), async (req, res) => {
    try {
        const adminUser = req.user;
        // Get dashboard overview data
        const [totalUsers, totalOrders, totalRevenue, pendingVerifications] = await Promise.all([
            database_1.default.select({
                count: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
            }).from(schema_1.users),
            database_1.default.select({
                count: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
            }).from(schema_1.orders),
            database_1.default.select({
                revenue: (0, drizzle_orm_1.sql) `sum(${schema_1.orders.totalPrice})`,
            }).from(schema_1.orders).where((0, drizzle_orm_1.eq)(schema_1.orders.status, 'delivered')),
            database_1.default.select({
                count: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
            }).from(schema_1.driverVerifications).where((0, drizzle_orm_1.eq)(schema_1.driverVerifications.verificationStatus, 'PENDING')),
        ]);
        res.json({
            message: 'Admin dashboard loaded successfully',
            admin: {
                id: adminUser.userId,
                email: adminUser.email,
                role: adminUser.role,
            },
            overview: {
                totalUsers: totalUsers[0]?.count || 0,
                totalOrders: totalOrders[0]?.count || 0,
                totalRevenue: parseFloat(totalRevenue[0]?.revenue || '0'),
                pendingVerifications: pendingVerifications[0]?.count || 0,
            },
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        console.error('Admin dashboard error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get all users with filters
router.get('/users', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('ADMIN'), async (req, res) => {
    try {
        const { role, isVerified, isPhoneVerified, isIdentityVerified, search, page = 1, limit = 20 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        let whereConditions = [];
        if (role) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.users.role, role));
        }
        if (isVerified !== undefined) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.users.isVerified, isVerified === 'true'));
        }
        if (isPhoneVerified !== undefined) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.users.isPhoneVerified, isPhoneVerified === 'true'));
        }
        if (isIdentityVerified !== undefined) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.users.isIdentityVerified, isIdentityVerified === 'true'));
        }
        if (search) {
            whereConditions.push((0, drizzle_orm_1.or)((0, drizzle_orm_1.like)(schema_1.users.fullName, `%${search}%`), (0, drizzle_orm_1.like)(schema_1.users.email, `%${search}%`), (0, drizzle_orm_1.like)(schema_1.users.phone, `%${search}%`)));
        }
        const usersList = await database_1.default.select({
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
            createdAt: schema_1.users.createdAt,
        })
            .from(schema_1.users)
            .where(whereConditions.length > 0 ? (0, drizzle_orm_1.and)(...whereConditions) : undefined)
            .orderBy((0, drizzle_orm_1.desc)(schema_1.users.createdAt))
            .limit(Number(limit))
            .offset(offset);
        // Get total count
        const totalCountResult = await database_1.default.select({
            count: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
        })
            .from(schema_1.users)
            .where(whereConditions.length > 0 ? (0, drizzle_orm_1.and)(...whereConditions) : undefined);
        const totalCount = totalCountResult[0]?.count || 0;
        res.json({
            users: usersList,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: totalCount,
                totalPages: Math.ceil(totalCount / Number(limit)),
            },
        });
    }
    catch (error) {
        console.error('Get admin users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Verify user identity
router.put('/users/:id/verify', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;
        const { isVerified, isPhoneVerified, isIdentityVerified } = req.body;
        const updateData = {};
        if (isVerified !== undefined)
            updateData.isVerified = isVerified;
        if (isPhoneVerified !== undefined)
            updateData.isPhoneVerified = isPhoneVerified;
        if (isIdentityVerified !== undefined)
            updateData.isIdentityVerified = isIdentityVerified;
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'No verification fields provided' });
        }
        const updatedUser = await database_1.default.update(schema_1.users)
            .set(updateData)
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, Number(id)))
            .returning();
        if (updatedUser.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            message: 'User verification status updated',
            user: {
                id: updatedUser[0].id,
                fullName: updatedUser[0].fullName,
                email: updatedUser[0].email,
                isVerified: updatedUser[0].isVerified,
                isPhoneVerified: updatedUser[0].isPhoneVerified,
                isIdentityVerified: updatedUser[0].isIdentityVerified,
            },
        });
    }
    catch (error) {
        console.error('Verify user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get platform-wide analytics
router.get('/analytics/platform', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('ADMIN'), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        // Set default date range (last 30 days)
        const end = endDate ? new Date(endDate) : new Date();
        const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        // Get platform statistics
        const [totalUsers, totalMerchants, totalDrivers, totalProducts, totalOrders, totalRevenue, pendingDeliveries, supportTicketsOpen] = await Promise.all([
            // Total users
            database_1.default.select({
                count: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
            }).from(schema_1.users),
            // Total merchants
            database_1.default.select({
                count: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
            }).from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.role, 'MERCHANT')),
            // Total drivers
            database_1.default.select({
                count: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
            }).from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.role, 'DRIVER')),
            // Total products
            database_1.default.select({
                count: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
            }).from(schema_1.products).where((0, drizzle_orm_1.eq)(schema_1.products.isActive, true)),
            // Total orders in date range
            database_1.default.select({
                count: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
            }).from(schema_1.orders).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.sql) `${schema_1.orders.createdAt} >= ${start}`, (0, drizzle_orm_1.sql) `${schema_1.orders.createdAt} <= ${end}`)),
            // Total revenue in date range
            database_1.default.select({
                revenue: (0, drizzle_orm_1.sql) `sum(${schema_1.orders.totalPrice})`,
            }).from(schema_1.orders).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.orders.status, 'delivered'), (0, drizzle_orm_1.sql) `${schema_1.orders.createdAt} >= ${start}`, (0, drizzle_orm_1.sql) `${schema_1.orders.createdAt} <= ${end}`)),
            // Pending deliveries
            database_1.default.select({
                count: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
            }).from(schema_1.deliveryRequests).where((0, drizzle_orm_1.eq)(schema_1.deliveryRequests.status, 'PENDING')),
            // Open support tickets
            database_1.default.select({
                count: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
            }).from(schema_1.supportTickets).where((0, drizzle_orm_1.eq)(schema_1.supportTickets.status, 'OPEN')),
        ]);
        // Get user growth over time
        const userGrowth = await database_1.default.select({
            date: (0, drizzle_orm_1.sql) `date(${schema_1.users.createdAt})`,
            newUsers: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
        })
            .from(schema_1.users)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.sql) `${schema_1.users.createdAt} >= ${start}`, (0, drizzle_orm_1.sql) `${schema_1.users.createdAt} <= ${end}`))
            .groupBy((0, drizzle_orm_1.sql) `date(${schema_1.users.createdAt})`)
            .orderBy((0, drizzle_orm_1.sql) `date(${schema_1.users.createdAt})`);
        // Get order status breakdown
        const ordersByStatus = await database_1.default.select({
            status: schema_1.orders.status,
            count: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
        })
            .from(schema_1.orders)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.sql) `${schema_1.orders.createdAt} >= ${start}`, (0, drizzle_orm_1.sql) `${schema_1.orders.createdAt} <= ${end}`))
            .groupBy(schema_1.orders.status);
        res.json({
            dateRange: { start, end },
            overview: {
                totalUsers: totalUsers[0]?.count || 0,
                totalMerchants: totalMerchants[0]?.count || 0,
                totalDrivers: totalDrivers[0]?.count || 0,
                totalProducts: totalProducts[0]?.count || 0,
                totalOrders: totalOrders[0]?.count || 0,
                totalRevenue: parseFloat(totalRevenue[0]?.revenue || '0'),
                pendingDeliveries: pendingDeliveries[0]?.count || 0,
                supportTicketsOpen: supportTicketsOpen[0]?.count || 0,
            },
            userGrowth: userGrowth.map(day => ({
                date: day.date,
                newUsers: day.newUsers,
            })),
            ordersByStatus: ordersByStatus.reduce((acc, item) => {
                acc[item.status || 'unknown'] = item.count;
                return acc;
            }, {}),
        });
    }
    catch (error) {
        console.error('Get platform analytics error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get pending driver verification requests
router.get('/drivers/verification-requests', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('ADMIN'), async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        const verificationRequests = await database_1.default.select({
            verification: schema_1.driverVerifications,
            user: {
                id: schema_1.users.id,
                fullName: schema_1.users.fullName,
                email: schema_1.users.email,
                phone: schema_1.users.phone,
                userId: schema_1.users.userId,
            },
        })
            .from(schema_1.driverVerifications)
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.driverVerifications.userId, schema_1.users.id))
            .where((0, drizzle_orm_1.eq)(schema_1.driverVerifications.verificationStatus, 'PENDING'))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.driverVerifications.createdAt))
            .limit(Number(limit))
            .offset(offset);
        // Get total count
        const totalCountResult = await database_1.default.select({
            count: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
        })
            .from(schema_1.driverVerifications)
            .where((0, drizzle_orm_1.eq)(schema_1.driverVerifications.verificationStatus, 'PENDING'));
        const totalCount = totalCountResult[0]?.count || 0;
        res.json({
            verificationRequests,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: totalCount,
                totalPages: Math.ceil(totalCount / Number(limit)),
            },
        });
    }
    catch (error) {
        console.error('Get driver verification requests error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Suspend or activate user account (using isVerified as status flag)
router.put('/users/:id/status', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;
        if (typeof isActive !== 'boolean') {
            return res.status(400).json({ error: 'isActive must be a boolean value' });
        }
        // For now, we use isVerified as the status flag since there's no isActive field
        // In production, you'd want to add an isActive field to the users table
        const updatedUser = await database_1.default.update(schema_1.users)
            .set({
            isVerified: isActive // Using verification status as a proxy for active status
        })
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, Number(id)))
            .returning();
        if (updatedUser.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            message: `User account ${isActive ? 'activated' : 'suspended'} successfully`,
            user: {
                id: updatedUser[0].id,
                fullName: updatedUser[0].fullName,
                email: updatedUser[0].email,
                isVerified: updatedUser[0].isVerified,
            },
        });
    }
    catch (error) {
        console.error('Update user status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get system health metrics
router.get('/system/health', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('ADMIN'), async (req, res) => {
    try {
        // Get various system metrics
        const [recentOrders, recentUsers, activeDeliveries, recentErrors] = await Promise.all([
            // Recent orders (last hour)
            database_1.default.select({
                count: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
            }).from(schema_1.orders).where((0, drizzle_orm_1.sql) `${schema_1.orders.createdAt} >= NOW() - INTERVAL '1 hour'`),
            // Recent user registrations (last hour)
            database_1.default.select({
                count: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
            }).from(schema_1.users).where((0, drizzle_orm_1.sql) `${schema_1.users.createdAt} >= NOW() - INTERVAL '1 hour'`),
            // Active deliveries
            database_1.default.select({
                count: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
            }).from(schema_1.deliveryRequests).where((0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_1.deliveryRequests.status, 'ASSIGNED'), (0, drizzle_orm_1.eq)(schema_1.deliveryRequests.status, 'PICKED_UP'), (0, drizzle_orm_1.eq)(schema_1.deliveryRequests.status, 'IN_TRANSIT'))),
            // Recent support tickets (last 24 hours)
            database_1.default.select({
                count: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
            }).from(schema_1.supportTickets).where((0, drizzle_orm_1.sql) `${schema_1.supportTickets.createdAt} >= NOW() - INTERVAL '24 hours'`),
        ]);
        res.json({
            timestamp: new Date().toISOString(),
            metrics: {
                ordersLastHour: recentOrders[0]?.count || 0,
                newUsersLastHour: recentUsers[0]?.count || 0,
                activeDeliveries: activeDeliveries[0]?.count || 0,
                supportTicketsLast24h: recentErrors[0]?.count || 0,
            },
            status: 'healthy', // In a real app, you'd calculate this based on various factors
        });
    }
    catch (error) {
        console.error('Get system health error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Create admin user (super admin only or initial setup)
router.post('/create-admin', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('ADMIN'), async (req, res) => {
    try {
        const { fullName, email, phone, password } = req.body;
        if (!fullName || !email || !phone || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        // Check if user already exists
        const existingUser = await database_1.default.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.email, email));
        if (existingUser.length > 0) {
            return res.status(400).json({ error: 'User with this email already exists' });
        }
        // Generate unique user ID
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
            message: 'Admin user created successfully',
            admin: {
                id: newAdmin[0].id,
                userId: newAdmin[0].userId,
                fullName: newAdmin[0].fullName,
                email: newAdmin[0].email,
                role: newAdmin[0].role,
            },
        });
    }
    catch (error) {
        console.error('Create admin error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
