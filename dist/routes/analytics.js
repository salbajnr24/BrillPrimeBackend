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
// Get merchant dashboard analytics
router.get('/dashboard', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('MERCHANT'), async (req, res) => {
    try {
        const merchantId = req.user.userId;
        const { startDate, endDate } = req.query;
        // Set default date range (last 30 days)
        const end = endDate ? new Date(endDate) : new Date();
        const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        // Get basic stats
        const [totalOrders, totalRevenue, totalProducts, totalPosts] = await Promise.all([
            // Total orders
            database_1.default.select({
                count: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
            })
                .from(schema_1.orders)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.orders.sellerId, merchantId), (0, drizzle_orm_1.gte)(schema_1.orders.createdAt, start), (0, drizzle_orm_1.lte)(schema_1.orders.createdAt, end))),
            // Total revenue
            database_1.default.select({
                revenue: (0, drizzle_orm_1.sql) `sum(${schema_1.orders.totalPrice})`,
            })
                .from(schema_1.orders)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.orders.sellerId, merchantId), (0, drizzle_orm_1.eq)(schema_1.orders.status, 'delivered'), (0, drizzle_orm_1.gte)(schema_1.orders.createdAt, start), (0, drizzle_orm_1.lte)(schema_1.orders.createdAt, end))),
            // Total products
            database_1.default.select({
                count: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
            })
                .from(schema_1.products)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.products.sellerId, merchantId), (0, drizzle_orm_1.eq)(schema_1.products.isActive, true))),
            // Total posts
            database_1.default.select({
                count: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
            })
                .from(schema_1.vendorPosts)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.vendorPosts.vendorId, merchantId), (0, drizzle_orm_1.eq)(schema_1.vendorPosts.isActive, true), (0, drizzle_orm_1.gte)(schema_1.vendorPosts.createdAt, start), (0, drizzle_orm_1.lte)(schema_1.vendorPosts.createdAt, end))),
        ]);
        // Get order status breakdown
        const ordersByStatus = await database_1.default.select({
            status: schema_1.orders.status,
            count: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
        })
            .from(schema_1.orders)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.orders.sellerId, merchantId), (0, drizzle_orm_1.gte)(schema_1.orders.createdAt, start), (0, drizzle_orm_1.lte)(schema_1.orders.createdAt, end)))
            .groupBy(schema_1.orders.status);
        // Get top performing products
        const topProducts = await database_1.default.select({
            productId: schema_1.orders.productId,
            productName: schema_1.products.name,
            totalOrders: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
            totalRevenue: (0, drizzle_orm_1.sql) `sum(${schema_1.orders.totalPrice})`,
        })
            .from(schema_1.orders)
            .leftJoin(schema_1.products, (0, drizzle_orm_1.eq)(schema_1.orders.productId, schema_1.products.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.orders.sellerId, merchantId), (0, drizzle_orm_1.gte)(schema_1.orders.createdAt, start), (0, drizzle_orm_1.lte)(schema_1.orders.createdAt, end)))
            .groupBy(schema_1.orders.productId, schema_1.products.name)
            .orderBy((0, drizzle_orm_1.desc)((0, drizzle_orm_1.sql) `count(*)`))
            .limit(10);
        // Get recent orders
        const recentOrders = await database_1.default.select({
            id: schema_1.orders.id,
            quantity: schema_1.orders.quantity,
            totalPrice: schema_1.orders.totalPrice,
            status: schema_1.orders.status,
            createdAt: schema_1.orders.createdAt,
            product: {
                name: schema_1.products.name,
                image: schema_1.products.image,
            },
            buyer: {
                fullName: schema_1.users.fullName,
                profilePicture: schema_1.users.profilePicture,
            },
        })
            .from(schema_1.orders)
            .leftJoin(schema_1.products, (0, drizzle_orm_1.eq)(schema_1.orders.productId, schema_1.products.id))
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.orders.buyerId, schema_1.users.id))
            .where((0, drizzle_orm_1.eq)(schema_1.orders.sellerId, merchantId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.orders.createdAt))
            .limit(10);
        res.json({
            dateRange: { start, end },
            summary: {
                totalOrders: totalOrders[0]?.count || 0,
                totalRevenue: parseFloat(totalRevenue[0]?.revenue || '0'),
                totalProducts: totalProducts[0]?.count || 0,
                totalPosts: totalPosts[0]?.count || 0,
            },
            ordersByStatus: ordersByStatus.reduce((acc, item) => {
                acc[item.status || 'unknown'] = item.count;
                return acc;
            }, {}),
            topProducts,
            recentOrders,
        });
    }
    catch (error) {
        console.error('Get merchant analytics error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get sales analytics
router.get('/sales', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('MERCHANT'), async (req, res) => {
    try {
        const merchantId = req.user.userId;
        const { period = 'week', startDate, endDate } = req.query;
        // Set date range based on period
        let start, end;
        if (startDate && endDate) {
            start = new Date(startDate);
            end = new Date(endDate);
        }
        else {
            end = new Date();
            switch (period) {
                case 'week':
                    start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                    break;
                case 'year':
                    start = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
                    break;
                default:
                    start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            }
        }
        // Get daily sales data
        const dailySales = await database_1.default.select({
            date: (0, drizzle_orm_1.sql) `date(${schema_1.orders.createdAt})`,
            orders: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
            revenue: (0, drizzle_orm_1.sql) `sum(${schema_1.orders.totalPrice})`,
        })
            .from(schema_1.orders)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.orders.sellerId, merchantId), (0, drizzle_orm_1.gte)(schema_1.orders.createdAt, start), (0, drizzle_orm_1.lte)(schema_1.orders.createdAt, end)))
            .groupBy((0, drizzle_orm_1.sql) `date(${schema_1.orders.createdAt})`)
            .orderBy((0, drizzle_orm_1.sql) `date(${schema_1.orders.createdAt})`);
        // Get category performance
        const categoryPerformance = await database_1.default.select({
            categoryName: (0, drizzle_orm_1.sql) `coalesce(${schema_1.products.name}, 'Unknown')`,
            orders: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
            revenue: (0, drizzle_orm_1.sql) `sum(${schema_1.orders.totalPrice})`,
        })
            .from(schema_1.orders)
            .leftJoin(schema_1.products, (0, drizzle_orm_1.eq)(schema_1.orders.productId, schema_1.products.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.orders.sellerId, merchantId), (0, drizzle_orm_1.gte)(schema_1.orders.createdAt, start), (0, drizzle_orm_1.lte)(schema_1.orders.createdAt, end)))
            .groupBy(schema_1.products.name)
            .orderBy((0, drizzle_orm_1.desc)((0, drizzle_orm_1.sql) `sum(${schema_1.orders.totalPrice})`));
        res.json({
            period,
            dateRange: { start, end },
            dailySales: dailySales.map(day => ({
                date: day.date,
                orders: day.orders,
                revenue: parseFloat(day.revenue || '0'),
            })),
            categoryPerformance: categoryPerformance.map(cat => ({
                category: cat.categoryName,
                orders: cat.orders,
                revenue: parseFloat(cat.revenue || '0'),
            })),
        });
    }
    catch (error) {
        console.error('Get sales analytics error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Record daily analytics (internal function, can be called by cron job)
router.post('/record-daily', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('MERCHANT'), async (req, res) => {
    try {
        const merchantId = req.user.userId;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // Check if today's analytics already recorded
        const existing = await database_1.default.select().from(schema_1.merchantAnalytics).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.merchantAnalytics.merchantId, merchantId), (0, drizzle_orm_1.eq)(schema_1.merchantAnalytics.date, today)));
        if (existing.length > 0) {
            return res.json({ message: 'Daily analytics already recorded for today' });
        }
        // Calculate today's metrics
        const [salesData, ordersData, viewsData] = await Promise.all([
            // Daily sales
            database_1.default.select({
                sales: (0, drizzle_orm_1.sql) `sum(${schema_1.orders.totalPrice})`,
            })
                .from(schema_1.orders)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.orders.sellerId, merchantId), (0, drizzle_orm_1.eq)(schema_1.orders.status, 'delivered'), (0, drizzle_orm_1.gte)(schema_1.orders.createdAt, today), (0, drizzle_orm_1.lte)(schema_1.orders.createdAt, new Date()))),
            // Daily orders
            database_1.default.select({
                orders: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
            })
                .from(schema_1.orders)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.orders.sellerId, merchantId), (0, drizzle_orm_1.gte)(schema_1.orders.createdAt, today), (0, drizzle_orm_1.lte)(schema_1.orders.createdAt, new Date()))),
            // Post views (sum of all post views for today)
            database_1.default.select({
                views: (0, drizzle_orm_1.sql) `sum(${schema_1.vendorPosts.viewCount})`.mapWith(Number),
            })
                .from(schema_1.vendorPosts)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.vendorPosts.vendorId, merchantId), (0, drizzle_orm_1.eq)(schema_1.vendorPosts.isActive, true))),
        ]);
        // Find top product for today
        const topProduct = await database_1.default.select({
            productId: schema_1.orders.productId,
            orderCount: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
        })
            .from(schema_1.orders)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.orders.sellerId, merchantId), (0, drizzle_orm_1.gte)(schema_1.orders.createdAt, today), (0, drizzle_orm_1.lte)(schema_1.orders.createdAt, new Date())))
            .groupBy(schema_1.orders.productId)
            .orderBy((0, drizzle_orm_1.desc)((0, drizzle_orm_1.sql) `count(*)`))
            .limit(1);
        const analytics = await database_1.default.insert(schema_1.merchantAnalytics).values({
            merchantId,
            date: today,
            dailySales: salesData[0]?.sales || '0',
            dailyOrders: ordersData[0]?.orders || 0,
            dailyViews: viewsData[0]?.views || 0,
            dailyClicks: 0, // This would be tracked separately in a real app
            topProduct: topProduct[0]?.productId || null,
            peakHour: new Date().getHours(), // Simple implementation
        }).returning();
        res.json({
            message: 'Daily analytics recorded successfully',
            analytics: analytics[0],
        });
    }
    catch (error) {
        console.error('Record daily analytics error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get merchant profile analytics
router.get('/profile', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('MERCHANT'), async (req, res) => {
    try {
        const merchantId = req.user.userId;
        const profile = await database_1.default.select({
            profile: schema_1.merchantProfiles,
            user: {
                id: schema_1.users.id,
                fullName: schema_1.users.fullName,
                email: schema_1.users.email,
                phone: schema_1.users.phone,
                city: schema_1.users.city,
                state: schema_1.users.state,
                createdAt: schema_1.users.createdAt,
            },
        })
            .from(schema_1.merchantProfiles)
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.merchantProfiles.userId, schema_1.users.id))
            .where((0, drizzle_orm_1.eq)(schema_1.merchantProfiles.userId, merchantId));
        if (profile.length === 0) {
            return res.status(404).json({ error: 'Merchant profile not found' });
        }
        // Get additional stats
        const [productStats, orderStats, postStats] = await Promise.all([
            // Product statistics
            database_1.default.select({
                total: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
                active: (0, drizzle_orm_1.sql) `count(*) filter (where ${schema_1.products.isActive} = true)`.mapWith(Number),
                avgRating: (0, drizzle_orm_1.sql) `avg(${schema_1.products.rating})`,
            })
                .from(schema_1.products)
                .where((0, drizzle_orm_1.eq)(schema_1.products.sellerId, merchantId)),
            // Order statistics
            database_1.default.select({
                total: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
                delivered: (0, drizzle_orm_1.sql) `count(*) filter (where ${schema_1.orders.status} = 'delivered')`.mapWith(Number),
                pending: (0, drizzle_orm_1.sql) `count(*) filter (where ${schema_1.orders.status} = 'pending')`.mapWith(Number),
                totalRevenue: (0, drizzle_orm_1.sql) `sum(${schema_1.orders.totalPrice}) filter (where ${schema_1.orders.status} = 'delivered')`,
            })
                .from(schema_1.orders)
                .where((0, drizzle_orm_1.eq)(schema_1.orders.sellerId, merchantId)),
            // Post statistics
            database_1.default.select({
                total: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
                totalViews: (0, drizzle_orm_1.sql) `sum(${schema_1.vendorPosts.viewCount})`.mapWith(Number),
                totalLikes: (0, drizzle_orm_1.sql) `sum(${schema_1.vendorPosts.likeCount})`.mapWith(Number),
                totalComments: (0, drizzle_orm_1.sql) `sum(${schema_1.vendorPosts.commentCount})`.mapWith(Number),
            })
                .from(schema_1.vendorPosts)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.vendorPosts.vendorId, merchantId), (0, drizzle_orm_1.eq)(schema_1.vendorPosts.isActive, true))),
        ]);
        res.json({
            profile: profile[0],
            stats: {
                products: productStats[0],
                orders: {
                    ...orderStats[0],
                    totalRevenue: parseFloat(orderStats[0]?.totalRevenue || '0'),
                },
                posts: postStats[0],
            },
        });
    }
    catch (error) {
        console.error('Get merchant profile analytics error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=analytics.js.map