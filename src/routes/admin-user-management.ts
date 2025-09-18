
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../utils/auth';
import { ValidationMiddleware } from '../middleware/validation';
import db from '../config/database';
import { users, orders, transactions } from '../schema';
import { eq, and, desc, count, sql, like, or, gte, lte } from 'drizzle-orm';
import bcrypt from 'bcrypt';

const router = Router();

// Admin authentication middleware
const requireAdmin = (req: Request, res: Response, next: any) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Validation schemas
const UserQuerySchema = z.object({
  page: z.string().transform(val => parseInt(val) || 1),
  limit: z.string().transform(val => Math.min(parseInt(val) || 20, 100)),
  search: z.string().optional(),
  role: z.enum(['USER', 'MERCHANT', 'DRIVER', 'ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']).optional(),
  sortBy: z.enum(['createdAt', 'email', 'firstName', 'lastLogin']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional()
});

const UpdateUserSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  email: z.string().email().optional(),
  phoneNumber: z.string().optional(),
  role: z.enum(['USER', 'MERCHANT', 'DRIVER', 'ADMIN']).optional(),
  isActive: z.boolean().optional(),
  emailVerified: z.boolean().optional()
});

const BulkActionSchema = z.object({
  userIds: z.array(z.number()),
  action: z.enum(['SUSPEND', 'ACTIVATE', 'DELETE', 'VERIFY_EMAIL']),
  reason: z.string().optional()
});

// Get users with filtering and pagination
router.get('/',
  authenticateToken,
  requireAdmin,
  ValidationMiddleware.validate({ query: UserQuerySchema }),
  async (req: Request, res: Response) => {
    try {
      const { page, limit, search, role, status, sortBy, sortOrder } = req.query as any;
      const offset = (page - 1) * limit;

      // Build where conditions
      let whereConditions: any[] = [];

      if (search) {
        whereConditions.push(
          or(
            like(users.firstName, `%${search}%`),
            like(users.lastName, `%${search}%`),
            like(users.email, `%${search}%`)
          )
        );
      }

      if (role) {
        whereConditions.push(eq(users.role, role));
      }

      if (status === 'ACTIVE') {
        whereConditions.push(eq(users.isActive, true));
      } else if (status === 'SUSPENDED') {
        whereConditions.push(eq(users.isActive, false));
      }

      // Build order by clause
      const orderByField = sortBy || 'createdAt';
      const order = sortOrder === 'asc' ? sql`ASC` : sql`DESC`;

      const [usersData, totalCount] = await Promise.all([
        db.select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          phoneNumber: users.phoneNumber,
          role: users.role,
          isActive: users.isActive,
          emailVerified: users.emailVerified,
          createdAt: users.createdAt,
          lastLogin: users.lastLogin,
          profileImage: users.profileImage
        })
        .from(users)
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
        .orderBy(sql`${sql.identifier(orderByField)} ${order}`)
        .limit(limit)
        .offset(offset),

        db.select({ count: count() })
          .from(users)
          .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
          .then(result => result[0].count)
      ]);

      // Get additional stats for each user
      const enrichedUsers = await Promise.all(
        usersData.map(async (user) => {
          const [orderStats, transactionStats] = await Promise.all([
            db.select({ 
              totalOrders: count(),
              lastOrderDate: sql<Date>`MAX(created_at)`
            })
            .from(orders)
            .where(eq(orders.customerId, user.id)),

            db.select({
              totalSpent: sql<number>`COALESCE(SUM(amount), 0)`
            })
            .from(transactions)
            .where(and(
              eq(transactions.userId, user.id),
              eq(transactions.type, 'PAYMENT'),
              eq(transactions.status, 'COMPLETED')
            ))
          ]);

          return {
            ...user,
            stats: {
              totalOrders: orderStats[0]?.totalOrders || 0,
              totalSpent: transactionStats[0]?.totalSpent || 0,
              lastOrderDate: orderStats[0]?.lastOrderDate
            }
          };
        })
      );

      res.json({
        success: true,
        data: {
          users: enrichedUsers,
          pagination: {
            page,
            limit,
            total: totalCount,
            pages: Math.ceil(totalCount / limit)
          }
        }
      });
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  }
);

// Get user details with comprehensive information
router.get('/:userId',
  authenticateToken,
  requireAdmin,
  ValidationMiddleware.validate({ 
    params: z.object({ userId: z.string().transform(val => parseInt(val)) })
  }),
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Get comprehensive user data
      const [orderHistory, transactionHistory, recentActivity] = await Promise.all([
        db.select({
          id: orders.id,
          status: orders.status,
          totalAmount: orders.totalAmount,
          createdAt: orders.createdAt
        })
        .from(orders)
        .where(eq(orders.customerId, userId))
        .orderBy(desc(orders.createdAt))
        .limit(10),

        db.select({
          id: transactions.id,
          type: transactions.type,
          amount: transactions.amount,
          status: transactions.status,
          createdAt: transactions.createdAt
        })
        .from(transactions)
        .where(eq(transactions.userId, userId))
        .orderBy(desc(transactions.createdAt))
        .limit(10),

        db.select({
          totalOrders: count(),
          totalSpent: sql<number>`COALESCE(SUM(amount), 0)`,
          avgOrderValue: sql<number>`COALESCE(AVG(amount), 0)`
        })
        .from(transactions)
        .where(and(
          eq(transactions.userId, userId),
          eq(transactions.type, 'PAYMENT'),
          eq(transactions.status, 'COMPLETED')
        ))
      ]);

      res.json({
        success: true,
        data: {
          user,
          orderHistory,
          transactionHistory,
          statistics: recentActivity[0] || {
            totalOrders: 0,
            totalSpent: 0,
            avgOrderValue: 0
          }
        }
      });
    } catch (error) {
      console.error('Get user details error:', error);
      res.status(500).json({ error: 'Failed to fetch user details' });
    }
  }
);

// Update user
router.put('/:userId',
  authenticateToken,
  requireAdmin,
  ValidationMiddleware.validate({ 
    params: z.object({ userId: z.string().transform(val => parseInt(val)) }),
    body: UpdateUserSchema
  }),
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const updates = req.body;

      // Check if user exists
      const [existingUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      
      if (!existingUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // If email is being updated, check for conflicts
      if (updates.email && updates.email !== existingUser.email) {
        const [emailConflict] = await db.select()
          .from(users)
          .where(and(eq(users.email, updates.email), sql`id != ${userId}`))
          .limit(1);

        if (emailConflict) {
          return res.status(400).json({ error: 'Email already in use' });
        }
      }

      const [updatedUser] = await db.update(users)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning();

      res.json({
        success: true,
        data: updatedUser,
        message: 'User updated successfully'
      });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  }
);

// Bulk actions on users
router.post('/bulk-action',
  authenticateToken,
  requireAdmin,
  ValidationMiddleware.validate({ body: BulkActionSchema }),
  async (req: Request, res: Response) => {
    try {
      const { userIds, action, reason } = req.body;

      let results: any = {};

      switch (action) {
        case 'SUSPEND':
          results = await db.update(users)
            .set({ isActive: false, updatedAt: new Date() })
            .where(sql`id = ANY(${userIds})`)
            .returning({ id: users.id });
          break;

        case 'ACTIVATE':
          results = await db.update(users)
            .set({ isActive: true, updatedAt: new Date() })
            .where(sql`id = ANY(${userIds})`)
            .returning({ id: users.id });
          break;

        case 'VERIFY_EMAIL':
          results = await db.update(users)
            .set({ emailVerified: true, updatedAt: new Date() })
            .where(sql`id = ANY(${userIds})`)
            .returning({ id: users.id });
          break;

        case 'DELETE':
          // Soft delete by marking as inactive and anonymizing
          results = await db.update(users)
            .set({ 
              isActive: false,
              email: sql`CONCAT('deleted_', id, '@example.com')`,
              firstName: 'Deleted',
              lastName: 'User',
              updatedAt: new Date()
            })
            .where(sql`id = ANY(${userIds})`)
            .returning({ id: users.id });
          break;

        default:
          return res.status(400).json({ error: 'Invalid action' });
      }

      res.json({
        success: true,
        data: {
          affectedUsers: results.length,
          action,
          reason
        },
        message: `Bulk ${action.toLowerCase()} completed successfully`
      });
    } catch (error) {
      console.error('Bulk action error:', error);
      res.status(500).json({ error: 'Failed to perform bulk action' });
    }
  }
);

// Reset user password (admin only)
router.post('/:userId/reset-password',
  authenticateToken,
  requireAdmin,
  ValidationMiddleware.validate({ 
    params: z.object({ userId: z.string().transform(val => parseInt(val)) }),
    body: z.object({ 
      newPassword: z.string().min(8),
      notifyUser: z.boolean().optional()
    })
  }),
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { newPassword, notifyUser } = req.body;

      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await db.update(users)
        .set({ 
          passwordHash: hashedPassword,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));

      // TODO: Send notification email if notifyUser is true

      res.json({
        success: true,
        message: 'Password reset successfully'
      });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  }
);

// Get user analytics
router.get('/:userId/analytics',
  authenticateToken,
  requireAdmin,
  ValidationMiddleware.validate({ 
    params: z.object({ userId: z.string().transform(val => parseInt(val)) }),
    query: z.object({
      period: z.enum(['7d', '30d', '90d', '1y']).optional().default('30d')
    })
  }),
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { period } = req.query as any;

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      
      switch (period) {
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(startDate.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
      }

      const [orderStats, spendingStats, activityStats] = await Promise.all([
        db.select({
          totalOrders: count(),
          completedOrders: sql<number>`COUNT(CASE WHEN status = 'DELIVERED' THEN 1 END)`,
          cancelledOrders: sql<number>`COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END)`
        })
        .from(orders)
        .where(and(
          eq(orders.customerId, userId),
          gte(orders.createdAt, startDate),
          lte(orders.createdAt, endDate)
        )),

        db.select({
          totalSpent: sql<number>`COALESCE(SUM(amount), 0)`,
          avgOrderValue: sql<number>`COALESCE(AVG(amount), 0)`,
          totalTransactions: count()
        })
        .from(transactions)
        .where(and(
          eq(transactions.userId, userId),
          eq(transactions.type, 'PAYMENT'),
          eq(transactions.status, 'COMPLETED'),
          gte(transactions.createdAt, startDate),
          lte(transactions.createdAt, endDate)
        )),

        // Get daily activity for chart
        db.select({
          date: sql<string>`DATE(created_at)`,
          orders: count()
        })
        .from(orders)
        .where(and(
          eq(orders.customerId, userId),
          gte(orders.createdAt, startDate),
          lte(orders.createdAt, endDate)
        ))
        .groupBy(sql`DATE(created_at)`)
        .orderBy(sql`DATE(created_at)`)
      ]);

      res.json({
        success: true,
        data: {
          period,
          summary: {
            ...orderStats[0],
            ...spendingStats[0]
          },
          dailyActivity: activityStats
        }
      });
    } catch (error) {
      console.error('Get user analytics error:', error);
      res.status(500).json({ error: 'Failed to fetch user analytics' });
    }
  }
);

export default router;
