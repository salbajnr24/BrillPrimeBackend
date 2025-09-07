import { Router } from 'express';
import { eq, and, desc, sql, gte, lte } from 'drizzle-orm';
import db from '../config/database';
import { merchantAnalytics, orders, products, vendorPosts, users, merchantProfiles } from '../schema';
import { authenticateToken, authorizeRoles } from '../utils/auth';

const router = Router();

// Get merchant dashboard analytics
router.get('/dashboard', authenticateToken, authorizeRoles('MERCHANT'), async (req, res) => {
  try {
    const merchantId = (req as any).user.userId;
    const { startDate, endDate } = req.query;

    // Set default date range (last 30 days)
    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Get basic stats
    const [totalOrders, totalRevenue, totalProducts, totalPosts] = await Promise.all([
      // Total orders
      db.select({
        count: sql<number>`count(*)`.mapWith(Number),
      })
        .from(orders)
        .where(and(
          eq(orders.sellerId, merchantId),
          gte(orders.createdAt, start),
          lte(orders.createdAt, end)
        )),

      // Total revenue
      db.select({
        revenue: sql<string>`sum(${orders.totalPrice})`,
      })
        .from(orders)
        .where(and(
          eq(orders.sellerId, merchantId),
          eq(orders.status, 'delivered'),
          gte(orders.createdAt, start),
          lte(orders.createdAt, end)
        )),

      // Total products
      db.select({
        count: sql<number>`count(*)`.mapWith(Number),
      })
        .from(products)
        .where(and(
          eq(products.sellerId, merchantId),
          eq(products.isActive, true)
        )),

      // Total posts
      db.select({
        count: sql<number>`count(*)`.mapWith(Number),
      })
        .from(vendorPosts)
        .where(and(
          eq(vendorPosts.vendorId, merchantId),
          eq(vendorPosts.isActive, true),
          gte(vendorPosts.createdAt, start),
          lte(vendorPosts.createdAt, end)
        )),
    ]);

    // Get order status breakdown
    const ordersByStatus = await db.select({
      status: orders.status,
      count: sql<number>`count(*)`.mapWith(Number),
    })
      .from(orders)
      .where(and(
        eq(orders.sellerId, merchantId),
        gte(orders.createdAt, start),
        lte(orders.createdAt, end)
      ))
      .groupBy(orders.status);

    // Get top performing products
    const topProducts = await db.select({
      productId: orders.productId,
      productName: products.name,
      totalOrders: sql<number>`count(*)`.mapWith(Number),
      totalRevenue: sql<string>`sum(${orders.totalPrice})`,
    })
      .from(orders)
      .leftJoin(products, eq(orders.productId, products.id))
      .where(and(
        eq(orders.sellerId, merchantId),
        gte(orders.createdAt, start),
        lte(orders.createdAt, end)
      ))
      .groupBy(orders.productId, products.name)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    // Get recent orders
    const recentOrders = await db.select({
      id: orders.id,
      quantity: orders.quantity,
      totalPrice: orders.totalPrice,
      status: orders.status,
      createdAt: orders.createdAt,
      product: {
        name: products.name,
        image: products.image,
      },
      buyer: {
        fullName: users.fullName,
        profilePicture: users.profilePicture,
      },
    })
      .from(orders)
      .leftJoin(products, eq(orders.productId, products.id))
      .leftJoin(users, eq(orders.buyerId, users.id))
      .where(eq(orders.sellerId, merchantId))
      .orderBy(desc(orders.createdAt))
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
      }, {} as Record<string, number>),
      topProducts,
      recentOrders,
    });
  } catch (error) {
    console.error('Get merchant analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get sales analytics
router.get('/sales', authenticateToken, authorizeRoles('MERCHANT'), async (req, res) => {
  try {
    const merchantId = (req as any).user.userId;
    const { period = 'week', startDate, endDate } = req.query;

    // Set date range based on period
    let start: Date, end: Date;
    if (startDate && endDate) {
      start = new Date(startDate as string);
      end = new Date(endDate as string);
    } else {
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
    const dailySales = await db.select({
      date: sql<string>`date(${orders.createdAt})`,
      orders: sql<number>`count(*)`.mapWith(Number),
      revenue: sql<string>`sum(${orders.totalPrice})`,
    })
      .from(orders)
      .where(and(
        eq(orders.sellerId, merchantId),
        gte(orders.createdAt, start),
        lte(orders.createdAt, end)
      ))
      .groupBy(sql`date(${orders.createdAt})`)
      .orderBy(sql`date(${orders.createdAt})`);

    // Get category performance
    const categoryPerformance = await db.select({
      categoryName: sql<string>`coalesce(${products.name}, 'Unknown')`,
      orders: sql<number>`count(*)`.mapWith(Number),
      revenue: sql<string>`sum(${orders.totalPrice})`,
    })
      .from(orders)
      .leftJoin(products, eq(orders.productId, products.id))
      .where(and(
        eq(orders.sellerId, merchantId),
        gte(orders.createdAt, start),
        lte(orders.createdAt, end)
      ))
      .groupBy(products.name)
      .orderBy(desc(sql`sum(${orders.totalPrice})`));

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
  } catch (error) {
    console.error('Get sales analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Record daily analytics (internal function, can be called by cron job)
router.post('/record-daily', authenticateToken, authorizeRoles('MERCHANT'), async (req, res) => {
  try {
    const merchantId = (req as any).user.userId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if today's analytics already recorded
    const existing = await db.select().from(merchantAnalytics).where(and(
      eq(merchantAnalytics.merchantId, merchantId),
      eq(merchantAnalytics.date, today)
    ));

    if (existing.length > 0) {
      return res.json({ message: 'Daily analytics already recorded for today' });
    }

    // Calculate today's metrics
    const [salesData, ordersData, viewsData] = await Promise.all([
      // Daily sales
      db.select({
        sales: sql<string>`sum(${orders.totalPrice})`,
      })
        .from(orders)
        .where(and(
          eq(orders.sellerId, merchantId),
          eq(orders.status, 'delivered'),
          gte(orders.createdAt, today),
          lte(orders.createdAt, new Date())
        )),

      // Daily orders
      db.select({
        orders: sql<number>`count(*)`.mapWith(Number),
      })
        .from(orders)
        .where(and(
          eq(orders.sellerId, merchantId),
          gte(orders.createdAt, today),
          lte(orders.createdAt, new Date())
        )),

      // Post views (sum of all post views for today)
      db.select({
        views: sql<number>`sum(${vendorPosts.viewCount})`.mapWith(Number),
      })
        .from(vendorPosts)
        .where(and(
          eq(vendorPosts.vendorId, merchantId),
          eq(vendorPosts.isActive, true)
        )),
    ]);

    // Find top product for today
    const topProduct = await db.select({
      productId: orders.productId,
      orderCount: sql<number>`count(*)`.mapWith(Number),
    })
      .from(orders)
      .where(and(
        eq(orders.sellerId, merchantId),
        gte(orders.createdAt, today),
        lte(orders.createdAt, new Date())
      ))
      .groupBy(orders.productId)
      .orderBy(desc(sql`count(*)`))
      .limit(1);

    const analytics = await db.insert(merchantAnalytics).values({
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
  } catch (error) {
    console.error('Record daily analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get merchant profile analytics
router.get('/profile', authenticateToken, authorizeRoles('MERCHANT'), async (req, res) => {
  try {
    const merchantId = (req as any).user.userId;

    const profile = await db.select({
      profile: merchantProfiles,
      user: {
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
        city: users.city,
        state: users.state,
        createdAt: users.createdAt,
      },
    })
      .from(merchantProfiles)
      .leftJoin(users, eq(merchantProfiles.userId, users.id))
      .where(eq(merchantProfiles.userId, merchantId));

    if (profile.length === 0) {
      return res.status(404).json({ error: 'Merchant profile not found' });
    }

    // Get additional stats
    const [productStats, orderStats, postStats] = await Promise.all([
      // Product statistics
      db.select({
        total: sql<number>`count(*)`.mapWith(Number),
        active: sql<number>`count(*) filter (where ${products.isActive} = true)`.mapWith(Number),
        avgRating: sql<string>`avg(${products.rating})`,
      })
        .from(products)
        .where(eq(products.sellerId, merchantId)),

      // Order statistics
      db.select({
        total: sql<number>`count(*)`.mapWith(Number),
        delivered: sql<number>`count(*) filter (where ${orders.status} = 'delivered')`.mapWith(Number),
        pending: sql<number>`count(*) filter (where ${orders.status} = 'pending')`.mapWith(Number),
        totalRevenue: sql<string>`sum(${orders.totalPrice}) filter (where ${orders.status} = 'delivered')`,
      })
        .from(orders)
        .where(eq(orders.sellerId, merchantId)),

      // Post statistics
      db.select({
        total: sql<number>`count(*)`.mapWith(Number),
        totalViews: sql<number>`sum(${vendorPosts.viewCount})`.mapWith(Number),
        totalLikes: sql<number>`sum(${vendorPosts.likeCount})`.mapWith(Number),
        totalComments: sql<number>`sum(${vendorPosts.commentCount})`.mapWith(Number),
      })
        .from(vendorPosts)
        .where(and(
          eq(vendorPosts.vendorId, merchantId),
          eq(vendorPosts.isActive, true)
        )),
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
  } catch (error) {
    console.error('Get merchant profile analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;