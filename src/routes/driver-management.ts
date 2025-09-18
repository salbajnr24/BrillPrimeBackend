
import { Router } from 'express';
import { db } from '../config/database';
import { users, orders } from '../schema';
import { eq, desc, and, count, sum, sql } from 'drizzle-orm';
import { authenticateToken } from '../utils/auth';
import { z } from 'zod';
import { AutoAssignmentService } from '../services/auto-assignment';

const router = Router();

const updateDriverStatusSchema = z.object({
  isOnline: z.boolean(),
  isAvailable: z.boolean().optional(),
  currentLocation: z.object({
    latitude: z.number(),
    longitude: z.number()
  }).optional()
});

const acceptOrderSchema = z.object({
  orderId: z.number(),
  estimatedDeliveryTime: z.number().optional()
});

// Get driver dashboard
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const driverId = req.user?.id;

    if (!driverId || req.user?.role !== 'DRIVER') {
      return res.status(403).json({ error: 'Driver access required' });
    }

    // Get today's metrics
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Today's deliveries and earnings
    const todayStats = await db
      .select({
        deliveries: count(),
        earnings: sum(sql`CAST(driver_earnings AS DECIMAL)`)
      })
      .from(orders)
      .where(and(
        eq(orders.driverId, driverId),
        eq(orders.status, 'DELIVERED'),
        sql`created_at >= ${today}`
      ));

    // Total stats
    const totalStats = await db
      .select({
        totalDeliveries: count(),
        totalEarnings: sum(sql`CAST(driver_earnings AS DECIMAL)`)
      })
      .from(orders)
      .where(eq(orders.driverId, driverId));

    // Active orders
    const activeOrders = await db
      .select()
      .from(orders)
      .where(and(
        eq(orders.driverId, driverId),
        sql`status NOT IN ('DELIVERED', 'CANCELLED')`
      ))
      .orderBy(desc(orders.createdAt))
      .limit(5);

    const metrics = {
      todayDeliveries: Number(todayStats[0]?.deliveries || 0),
      todayEarnings: Number(todayStats[0]?.earnings || 0),
      totalDeliveries: Number(totalStats[0]?.totalDeliveries || 0),
      totalEarnings: Number(totalStats[0]?.totalEarnings || 0),
      activeOrders,
      isAvailable: await AutoAssignmentService.getDriverAvailability(driverId)
    };

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Driver dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
  }
});

// Update driver status
router.put('/status', authenticateToken, async (req, res) => {
  try {
    const driverId = req.user?.id;

    if (!driverId || req.user?.role !== 'DRIVER') {
      return res.status(403).json({ error: 'Driver access required' });
    }

    const validatedData = updateDriverStatusSchema.parse(req.body);

    // Update driver status in database (would need driver_profiles table)
    // For now, store in session or user metadata
    req.session.driverStatus = {
      isOnline: validatedData.isOnline,
      isAvailable: validatedData.isAvailable,
      currentLocation: validatedData.currentLocation,
      lastUpdated: new Date()
    };

    // Broadcast status update
    if (global.io) {
      global.io.to(`user_${driverId}`).emit('status_updated', {
        isOnline: validatedData.isOnline,
        isAvailable: validatedData.isAvailable,
        timestamp: Date.now()
      });
    }

    res.json({ 
      success: true, 
      message: 'Driver status updated successfully' 
    });
  } catch (error: any) {
    console.error('Update driver status error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid status data' });
    }
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Accept order
router.post('/orders/accept', authenticateToken, async (req, res) => {
  try {
    const driverId = req.user?.id;

    if (!driverId || req.user?.role !== 'DRIVER') {
      return res.status(403).json({ error: 'Driver access required' });
    }

    const { orderId, estimatedDeliveryTime } = acceptOrderSchema.parse(req.body);

    // Check if driver is available
    const isAvailable = await AutoAssignmentService.getDriverAvailability(driverId);
    if (!isAvailable) {
      return res.status(400).json({ 
        error: 'Driver not available for new orders' 
      });
    }

    // Update order
    const [updatedOrder] = await db
      .update(orders)
      .set({
        driverId,
        status: 'ACCEPTED',
        acceptedAt: new Date(),
        estimatedDeliveryTime: estimatedDeliveryTime ? new Date(Date.now() + estimatedDeliveryTime * 60000) : null,
        updatedAt: new Date()
      })
      .where(and(
        eq(orders.id, orderId),
        sql`driver_id IS NULL` // Ensure order isn't already assigned
      ))
      .returning();

    if (!updatedOrder) {
      return res.status(400).json({ 
        error: 'Order not available or already assigned' 
      });
    }

    // Real-time notifications
    if (global.io) {
      global.io.to(`user_${updatedOrder.customerId}`).emit('order_accepted', {
        orderId: updatedOrder.id,
        driverId,
        estimatedDeliveryTime,
        timestamp: Date.now()
      });
    }

    res.json({
      success: true,
      message: 'Order accepted successfully',
      order: updatedOrder
    });
  } catch (error: any) {
    console.error('Accept order error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid order data' });
    }
    res.status(500).json({ error: 'Failed to accept order' });
  }
});

// Get available orders for driver
router.get('/orders/available', authenticateToken, async (req, res) => {
  try {
    const driverId = req.user?.id;

    if (!driverId || req.user?.role !== 'DRIVER') {
      return res.status(403).json({ error: 'Driver access required' });
    }

    // Get orders without assigned drivers
    const availableOrders = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        orderType: orders.orderType,
        totalAmount: orders.totalAmount,
        deliveryAddress: orders.deliveryAddress,
        createdAt: orders.createdAt,
        customerName: users.fullName
      })
      .from(orders)
      .leftJoin(users, eq(orders.customerId, users.id))
      .where(and(
        sql`driver_id IS NULL`,
        eq(orders.status, 'PENDING')
      ))
      .orderBy(desc(orders.createdAt))
      .limit(20);

    res.json({
      success: true,
      orders: availableOrders
    });
  } catch (error) {
    console.error('Get available orders error:', error);
    res.status(500).json({ error: 'Failed to fetch available orders' });
  }
});

export default router;
