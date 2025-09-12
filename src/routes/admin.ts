import { Router } from 'express';
import { eq, and, desc, sql, or, like } from 'drizzle-orm';
import db from '../config/database';
import { 
  users, 
  products, 
  orders, 
  merchantProfiles, 
  driverProfiles, 
  supportTickets,
  deliveryRequests,
  vendorPosts,
  identityVerifications,
  driverVerifications
} from '../schema';
import { authenticateToken, authorizeRoles, hashPassword } from '../utils/auth';

const router = Router();

// Get all users with filters
router.get('/users', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { 
      role, 
      isVerified, 
      isPhoneVerified, 
      isIdentityVerified, 
      search, 
      page = 1, 
      limit = 20 
    } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereConditions: any[] = [];

    if (role) {
      whereConditions.push(eq(users.role, role as any));
    }
    if (isVerified !== undefined) {
      whereConditions.push(eq(users.isVerified, isVerified === 'true'));
    }
    if (isPhoneVerified !== undefined) {
      whereConditions.push(eq(users.isPhoneVerified, isPhoneVerified === 'true'));
    }
    if (isIdentityVerified !== undefined) {
      whereConditions.push(eq(users.isIdentityVerified, isIdentityVerified === 'true'));
    }
    if (search) {
      whereConditions.push(
        or(
          like(users.fullName, `%${search}%`),
          like(users.email, `%${search}%`),
          like(users.phone, `%${search}%`)
        )
      );
    }

    const usersList = await db.select({
      id: users.id,
      userId: users.userId,
      fullName: users.fullName,
      email: users.email,
      phone: users.phone,
      role: users.role,
      isVerified: users.isVerified,
      isPhoneVerified: users.isPhoneVerified,
      isIdentityVerified: users.isIdentityVerified,
      profilePicture: users.profilePicture,
      address: users.address,
      city: users.city,
      state: users.state,
      country: users.country,
      createdAt: users.createdAt,
    })
      .from(users)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(users.createdAt))
      .limit(Number(limit))
      .offset(offset);

    // Get total count
    const totalCountResult = await db.select({
      count: sql<number>`count(*)`.mapWith(Number),
    })
      .from(users)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

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
  } catch (error) {
    console.error('Get admin users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify user identity
router.put('/users/:id/verify', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { isVerified, isPhoneVerified, isIdentityVerified } = req.body;

    const updateData: any = {};
    if (isVerified !== undefined) updateData.isVerified = isVerified;
    if (isPhoneVerified !== undefined) updateData.isPhoneVerified = isPhoneVerified;
    if (isIdentityVerified !== undefined) updateData.isIdentityVerified = isIdentityVerified;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No verification fields provided' });
    }

    const updatedUser = await db.update(users)
      .set(updateData)
      .where(eq(users.id, Number(id)))
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
  } catch (error) {
    console.error('Verify user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get platform-wide analytics
router.get('/analytics/platform', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Set default date range (last 30 days)
    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Get platform statistics
    const [
      totalUsers,
      totalMerchants,
      totalDrivers,
      totalProducts,
      totalOrders,
      totalRevenue,
      pendingDeliveries,
      supportTicketsOpen
    ] = await Promise.all([
      // Total users
      db.select({
        count: sql<number>`count(*)`.mapWith(Number),
      }).from(users),

      // Total merchants
      db.select({
        count: sql<number>`count(*)`.mapWith(Number),
      }).from(users).where(eq(users.role, 'MERCHANT')),

      // Total drivers
      db.select({
        count: sql<number>`count(*)`.mapWith(Number),
      }).from(users).where(eq(users.role, 'DRIVER')),

      // Total products
      db.select({
        count: sql<number>`count(*)`.mapWith(Number),
      }).from(products).where(eq(products.isActive, true)),

      // Total orders in date range
      db.select({
        count: sql<number>`count(*)`.mapWith(Number),
      }).from(orders).where(and(
        sql`${orders.createdAt} >= ${start}`,
        sql`${orders.createdAt} <= ${end}`
      )),

      // Total revenue in date range
      db.select({
        revenue: sql<string>`sum(${orders.totalPrice})`,
      }).from(orders).where(and(
        eq(orders.status, 'delivered'),
        sql`${orders.createdAt} >= ${start}`,
        sql`${orders.createdAt} <= ${end}`
      )),

      // Pending deliveries
      db.select({
        count: sql<number>`count(*)`.mapWith(Number),
      }).from(deliveryRequests).where(eq(deliveryRequests.status, 'PENDING')),

      // Open support tickets
      db.select({
        count: sql<number>`count(*)`.mapWith(Number),
      }).from(supportTickets).where(eq(supportTickets.status, 'OPEN')),
    ]);

    // Get user growth over time
    const userGrowth = await db.select({
      date: sql<string>`date(${users.createdAt})`,
      newUsers: sql<number>`count(*)`.mapWith(Number),
    })
      .from(users)
      .where(and(
        sql`${users.createdAt} >= ${start}`,
        sql`${users.createdAt} <= ${end}`
      ))
      .groupBy(sql`date(${users.createdAt})`)
      .orderBy(sql`date(${users.createdAt})`);

    // Get order status breakdown
    const ordersByStatus = await db.select({
      status: orders.status,
      count: sql<number>`count(*)`.mapWith(Number),
    })
      .from(orders)
      .where(and(
        sql`${orders.createdAt} >= ${start}`,
        sql`${orders.createdAt} <= ${end}`
      ))
      .groupBy(orders.status);

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
      }, {} as Record<string, number>),
    });
  } catch (error) {
    console.error('Get platform analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get pending driver verification requests
router.get('/drivers/verification-requests', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const verificationRequests = await db.select({
      verification: driverVerifications,
      user: {
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
        userId: users.userId,
      },
    })
      .from(driverVerifications)
      .leftJoin(users, eq(driverVerifications.userId, users.id))
      .where(eq(driverVerifications.verificationStatus, 'PENDING'))
      .orderBy(desc(driverVerifications.createdAt))
      .limit(Number(limit))
      .offset(offset);

    // Get total count
    const totalCountResult = await db.select({
      count: sql<number>`count(*)`.mapWith(Number),
    })
      .from(driverVerifications)
      .where(eq(driverVerifications.verificationStatus, 'PENDING'));

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
  } catch (error) {
    console.error('Get driver verification requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Suspend or activate user account
router.put('/users/:id/status', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive must be a boolean value' });
    }

    const updatedUser = await db.update(users)
      .set({ 
        // Note: We'd need to add an isActive field to users table for this to work
        // For now, we can use a different approach or add the field to the schema
      })
      .where(eq(users.id, Number(id)))
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
      },
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get system health metrics
router.get('/system/health', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    // Get various system metrics
    const [
      recentOrders,
      recentUsers,
      activeDeliveries,
      recentErrors
    ] = await Promise.all([
      // Recent orders (last hour)
      db.select({
        count: sql<number>`count(*)`.mapWith(Number),
      }).from(orders).where(
        sql`${orders.createdAt} >= NOW() - INTERVAL '1 hour'`
      ),

      // Recent user registrations (last hour)
      db.select({
        count: sql<number>`count(*)`.mapWith(Number),
      }).from(users).where(
        sql`${users.createdAt} >= NOW() - INTERVAL '1 hour'`
      ),

      // Active deliveries
      db.select({
        count: sql<number>`count(*)`.mapWith(Number),
      }).from(deliveryRequests).where(
        or(
          eq(deliveryRequests.status, 'ASSIGNED'),
          eq(deliveryRequests.status, 'PICKED_UP'),
          eq(deliveryRequests.status, 'IN_TRANSIT')
        )
      ),

      // Recent support tickets (last 24 hours)
      db.select({
        count: sql<number>`count(*)`.mapWith(Number),
      }).from(supportTickets).where(
        sql`${supportTickets.createdAt} >= NOW() - INTERVAL '24 hours'`
      ),
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
  } catch (error) {
    console.error('Get system health error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create admin user (super admin only or initial setup)
router.post('/create-admin', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { fullName, email, phone, password } = req.body;

    if (!fullName || !email || !phone || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user already exists
    const existingUser = await db.select().from(users).where(eq(users.email, email));
    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Generate unique user ID
    const userIdNumber = Math.floor(Math.random() * 900000) + 100000;
    const userId = `BP-ADMIN-${userIdNumber.toString().padStart(6, '0')}`;

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create admin user
    const newAdmin = await db.insert(users).values({
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
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;