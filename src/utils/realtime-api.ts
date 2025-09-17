
import { eq, and, desc, gte, sql } from 'drizzle-orm';
import db from '../config/database';
import { users, products, orders, userActivities, fraudAlerts } from '../schema';

export interface RealTimeApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
  executionTime: number;
}

export class RealTimeApiService {
  private static startTime(): number {
    return Date.now();
  }

  private static createResponse<T>(
    success: boolean, 
    data?: T, 
    error?: string, 
    startTime?: number
  ): RealTimeApiResponse<T> {
    return {
      success,
      data,
      error,
      timestamp: new Date().toISOString(),
      executionTime: startTime ? Date.now() - startTime : 0
    };
  }

  // User operations
  static async getUserById(id: number): Promise<RealTimeApiResponse> {
    const start = this.startTime();
    try {
      const user = await db.select().from(users).where(eq(users.id, id)).limit(1);
      
      if (user.length === 0) {
        return this.createResponse(false, null, 'User not found', start);
      }

      // Remove sensitive information
      const { password, ...safeUser } = user[0];
      return this.createResponse(true, safeUser, undefined, start);
    } catch (error) {
      console.error('Error fetching user:', error);
      return this.createResponse(false, null, 'Database error occurred', start);
    }
  }

  static async getUsersByRole(role: string, limit: number = 50): Promise<RealTimeApiResponse> {
    const start = this.startTime();
    try {
      const usersList = await db.select({
        id: users.id,
        userId: users.userId,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
        isVerified: users.isVerified,
        isActive: users.isActive,
        createdAt: users.createdAt
      }).from(users).where(eq(users.role, role as any)).limit(limit);

      return this.createResponse(true, usersList, undefined, start);
    } catch (error) {
      console.error('Error fetching users by role:', error);
      return this.createResponse(false, null, 'Database error occurred', start);
    }
  }

  // Product operations
  static async getActiveProducts(limit: number = 100): Promise<RealTimeApiResponse> {
    const start = this.startTime();
    try {
      const productsList = await db.select()
        .from(products)
        .where(and(eq(products.isActive, true), eq(products.inStock, true)))
        .orderBy(desc(products.createdAt))
        .limit(limit);

      return this.createResponse(true, productsList, undefined, start);
    } catch (error) {
      console.error('Error fetching products:', error);
      return this.createResponse(false, null, 'Database error occurred', start);
    }
  }

  static async getProductsBySeller(sellerId: number): Promise<RealTimeApiResponse> {
    const start = this.startTime();
    try {
      const productsList = await db.select()
        .from(products)
        .where(eq(products.sellerId, sellerId))
        .orderBy(desc(products.createdAt));

      return this.createResponse(true, productsList, undefined, start);
    } catch (error) {
      console.error('Error fetching seller products:', error);
      return this.createResponse(false, null, 'Database error occurred', start);
    }
  }

  // Order operations
  static async getOrdersByUser(userId: number, limit: number = 50): Promise<RealTimeApiResponse> {
    const start = this.startTime();
    try {
      const ordersList = await db.select()
        .from(orders)
        .where(eq(orders.buyerId, userId))
        .orderBy(desc(orders.createdAt))
        .limit(limit);

      return this.createResponse(true, ordersList, undefined, start);
    } catch (error) {
      console.error('Error fetching user orders:', error);
      return this.createResponse(false, null, 'Database error occurred', start);
    }
  }

  static async getOrdersByStatus(status: string, limit: number = 100): Promise<RealTimeApiResponse> {
    const start = this.startTime();
    try {
      const ordersList = await db.select()
        .from(orders)
        .where(eq(orders.status, status))
        .orderBy(desc(orders.createdAt))
        .limit(limit);

      return this.createResponse(true, ordersList, undefined, start);
    } catch (error) {
      console.error('Error fetching orders by status:', error);
      return this.createResponse(false, null, 'Database error occurred', start);
    }
  }

  // Activity monitoring
  static async getUserRecentActivity(userId: number, hours: number = 24): Promise<RealTimeApiResponse> {
    const start = this.startTime();
    try {
      const timeWindow = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      const activities = await db.select()
        .from(userActivities)
        .where(and(
          eq(userActivities.userId, userId),
          gte(userActivities.createdAt, timeWindow)
        ))
        .orderBy(desc(userActivities.createdAt));

      return this.createResponse(true, activities, undefined, start);
    } catch (error) {
      console.error('Error fetching user activity:', error);
      return this.createResponse(false, null, 'Database error occurred', start);
    }
  }

  // Fraud monitoring
  static async getActiveFraudAlerts(limit: number = 100): Promise<RealTimeApiResponse> {
    const start = this.startTime();
    try {
      const alerts = await db.select()
        .from(fraudAlerts)
        .where(eq(fraudAlerts.isResolved, false))
        .orderBy(desc(fraudAlerts.createdAt))
        .limit(limit);

      return this.createResponse(true, alerts, undefined, start);
    } catch (error) {
      console.error('Error fetching fraud alerts:', error);
      return this.createResponse(false, null, 'Database error occurred', start);
    }
  }

  // Analytics and statistics
  static async getDashboardStats(): Promise<RealTimeApiResponse> {
    const start = this.startTime();
    try {
      const [
        totalUsers,
        activeUsers,
        totalProducts,
        activeProducts,
        totalOrders,
        pendingOrders,
        fraudAlerts
      ] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(users),
        db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.isActive, true)),
        db.select({ count: sql<number>`count(*)` }).from(products),
        db.select({ count: sql<number>`count(*)` }).from(products).where(eq(products.isActive, true)),
        db.select({ count: sql<number>`count(*)` }).from(orders),
        db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.status, 'pending')),
        db.select({ count: sql<number>`count(*)` }).from(fraudAlerts).where(eq(fraudAlerts.isResolved, false))
      ]);

      const stats = {
        users: {
          total: totalUsers[0].count,
          active: activeUsers[0].count
        },
        products: {
          total: totalProducts[0].count,
          active: activeProducts[0].count
        },
        orders: {
          total: totalOrders[0].count,
          pending: pendingOrders[0].count
        },
        security: {
          activeFraudAlerts: fraudAlerts[0].count
        }
      };

      return this.createResponse(true, stats, undefined, start);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      return this.createResponse(false, null, 'Database error occurred', start);
    }
  }

  // Health check for database connectivity
  static async healthCheck(): Promise<RealTimeApiResponse> {
    const start = this.startTime();
    try {
      const result = await db.execute(sql`SELECT 1 as health_check`);
      
      return this.createResponse(true, {
        database: 'connected',
        timestamp: new Date().toISOString(),
        result: result
      }, undefined, start);
    } catch (error) {
      console.error('Database health check failed:', error);
      return this.createResponse(false, null, 'Database connection failed', start);
    }
  }
}
