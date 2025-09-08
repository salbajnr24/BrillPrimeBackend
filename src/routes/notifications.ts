
import { Router } from 'express';
import { eq, and, desc, sql, or } from 'drizzle-orm';
import db from '../config/database';
import { 
  merchantNotifications, 
  consumerNotifications, 
  driverNotifications,
  orders,
  deliveryRequests,
  users
} from '../schema';
import { authenticateToken, authorizeRoles } from '../utils/auth';

const router = Router();

// Utility function to create notifications
const createNotification = async (notificationData: {
  userId: number;
  userRole: 'CONSUMER' | 'MERCHANT' | 'DRIVER';
  title: string;
  message: string;
  type: string;
  relatedId?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  actionUrl?: string;
  expiresAt?: Date;
}) => {
  const { userId, userRole, title, message, type, relatedId, priority = 'MEDIUM', actionUrl, expiresAt } = notificationData;

  let notification;
  
  switch (userRole) {
    case 'CONSUMER':
      notification = await db.insert(consumerNotifications).values({
        consumerId: userId,
        title,
        message,
        type: type as any,
        relatedId,
        priority,
        actionUrl,
      }).returning();
      break;
    case 'MERCHANT':
      notification = await db.insert(merchantNotifications).values({
        merchantId: userId,
        title,
        message,
        type: type as any,
        relatedId,
        priority,
        actionUrl,
      }).returning();
      break;
    case 'DRIVER':
      notification = await db.insert(driverNotifications).values({
        driverId: userId,
        title,
        message,
        type: type as any,
        relatedId,
        priority,
        actionUrl,
        expiresAt,
      }).returning();
      break;
  }

  return notification?.[0];
};

// Get notifications for current user (works for all user types)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const userRole = (req as any).user.role;
    const { isRead, type, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let notifications: any[] = [];
    let totalCount = 0;

    switch (userRole) {
      case 'CONSUMER':
        {
          let whereConditions = [eq(consumerNotifications.consumerId, userId)];
          if (isRead !== undefined) {
            whereConditions.push(eq(consumerNotifications.isRead, isRead === 'true'));
          }
          if (type) {
            whereConditions.push(eq(consumerNotifications.type, type as any));
          }

          notifications = await db.select()
            .from(consumerNotifications)
            .where(and(...whereConditions))
            .orderBy(desc(consumerNotifications.createdAt))
            .limit(Number(limit))
            .offset(offset);

          const countResult = await db.select({
            count: sql<number>`count(*)`.mapWith(Number),
          })
            .from(consumerNotifications)
            .where(and(...whereConditions));

          totalCount = countResult[0]?.count || 0;
        }
        break;

      case 'MERCHANT':
        {
          let whereConditions = [eq(merchantNotifications.merchantId, userId)];
          if (isRead !== undefined) {
            whereConditions.push(eq(merchantNotifications.isRead, isRead === 'true'));
          }
          if (type) {
            whereConditions.push(eq(merchantNotifications.type, type as any));
          }

          notifications = await db.select()
            .from(merchantNotifications)
            .where(and(...whereConditions))
            .orderBy(desc(merchantNotifications.createdAt))
            .limit(Number(limit))
            .offset(offset);

          const countResult = await db.select({
            count: sql<number>`count(*)`.mapWith(Number),
          })
            .from(merchantNotifications)
            .where(and(...whereConditions));

          totalCount = countResult[0]?.count || 0;
        }
        break;

      case 'DRIVER':
        {
          let whereConditions = [eq(driverNotifications.driverId, userId)];
          if (isRead !== undefined) {
            whereConditions.push(eq(driverNotifications.isRead, isRead === 'true'));
          }
          if (type) {
            whereConditions.push(eq(driverNotifications.type, type as any));
          }

          notifications = await db.select()
            .from(driverNotifications)
            .where(and(...whereConditions))
            .orderBy(desc(driverNotifications.createdAt))
            .limit(Number(limit))
            .offset(offset);

          const countResult = await db.select({
            count: sql<number>`count(*)`.mapWith(Number),
          })
            .from(driverNotifications)
            .where(and(...whereConditions));

          totalCount = countResult[0]?.count || 0;
        }
        break;
    }

    res.json({
      notifications,
      userRole,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark notification as read
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    const userRole = (req as any).user.role;

    let notification;
    let updatedNotification;

    switch (userRole) {
      case 'CONSUMER':
        notification = await db.select()
          .from(consumerNotifications)
          .where(and(
            eq(consumerNotifications.id, id),
            eq(consumerNotifications.consumerId, userId)
          ));

        if (notification.length === 0) {
          return res.status(404).json({ error: 'Notification not found' });
        }

        updatedNotification = await db.update(consumerNotifications)
          .set({
            isRead: true,
            readAt: new Date(),
          })
          .where(eq(consumerNotifications.id, id))
          .returning();
        break;

      case 'MERCHANT':
        notification = await db.select()
          .from(merchantNotifications)
          .where(and(
            eq(merchantNotifications.id, id),
            eq(merchantNotifications.merchantId, userId)
          ));

        if (notification.length === 0) {
          return res.status(404).json({ error: 'Notification not found' });
        }

        updatedNotification = await db.update(merchantNotifications)
          .set({
            isRead: true,
            readAt: new Date(),
          })
          .where(eq(merchantNotifications.id, id))
          .returning();
        break;

      case 'DRIVER':
        notification = await db.select()
          .from(driverNotifications)
          .where(and(
            eq(driverNotifications.id, id),
            eq(driverNotifications.driverId, userId)
          ));

        if (notification.length === 0) {
          return res.status(404).json({ error: 'Notification not found' });
        }

        updatedNotification = await db.update(driverNotifications)
          .set({
            isRead: true,
            readAt: new Date(),
          })
          .where(eq(driverNotifications.id, id))
          .returning();
        break;
    }

    res.json({
      message: 'Notification marked as read',
      notification: updatedNotification?.[0],
    });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark all notifications as read
router.put('/mark-all-read', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const userRole = (req as any).user.role;

    switch (userRole) {
      case 'CONSUMER':
        await db.update(consumerNotifications)
          .set({
            isRead: true,
            readAt: new Date(),
          })
          .where(and(
            eq(consumerNotifications.consumerId, userId),
            eq(consumerNotifications.isRead, false)
          ));
        break;

      case 'MERCHANT':
        await db.update(merchantNotifications)
          .set({
            isRead: true,
            readAt: new Date(),
          })
          .where(and(
            eq(merchantNotifications.merchantId, userId),
            eq(merchantNotifications.isRead, false)
          ));
        break;

      case 'DRIVER':
        await db.update(driverNotifications)
          .set({
            isRead: true,
            readAt: new Date(),
          })
          .where(and(
            eq(driverNotifications.driverId, userId),
            eq(driverNotifications.isRead, false)
          ));
        break;
    }

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get unread notifications count
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const userRole = (req as any).user.role;

    let countResult;

    switch (userRole) {
      case 'CONSUMER':
        countResult = await db.select({
          count: sql<number>`count(*)`.mapWith(Number),
        })
          .from(consumerNotifications)
          .where(and(
            eq(consumerNotifications.consumerId, userId),
            eq(consumerNotifications.isRead, false)
          ));
        break;

      case 'MERCHANT':
        countResult = await db.select({
          count: sql<number>`count(*)`.mapWith(Number),
        })
          .from(merchantNotifications)
          .where(and(
            eq(merchantNotifications.merchantId, userId),
            eq(merchantNotifications.isRead, false)
          ));
        break;

      case 'DRIVER':
        countResult = await db.select({
          count: sql<number>`count(*)`.mapWith(Number),
        })
          .from(driverNotifications)
          .where(and(
            eq(driverNotifications.driverId, userId),
            eq(driverNotifications.isRead, false)
          ));
        break;
    }

    res.json({ 
      unreadCount: countResult?.[0]?.count || 0,
      userRole 
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create notification (internal API for system use)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      userId,
      userRole,
      title,
      message,
      type,
      relatedId,
      priority = 'MEDIUM',
      actionUrl,
      expiresAt,
    } = req.body;

    if (!userId || !userRole || !title || !message || !type) {
      return res.status(400).json({ 
        error: 'Required fields: userId, userRole, title, message, type' 
      });
    }

    if (!['CONSUMER', 'MERCHANT', 'DRIVER'].includes(userRole)) {
      return res.status(400).json({ 
        error: 'Invalid userRole. Must be CONSUMER, MERCHANT, or DRIVER' 
      });
    }

    const notification = await createNotification({
      userId,
      userRole,
      title,
      message,
      type,
      relatedId,
      priority,
      actionUrl,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    res.status(201).json({
      message: 'Notification created successfully',
      notification,
    });
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Order status notification triggers
router.post('/order-status', authenticateToken, authorizeRoles('MERCHANT', 'DRIVER', 'ADMIN'), async (req, res) => {
  try {
    const { orderId, status } = req.body;

    if (!orderId || !status) {
      return res.status(400).json({ error: 'Order ID and status are required' });
    }

    // Get order details
    const orderResult = await db.select({
      buyerId: orders.buyerId,
      sellerId: orders.sellerId,
      productName: sql<string>`'Order #' || ${orders.id}`,
      status: orders.status,
    })
      .from(orders)
      .where(eq(orders.id, orderId));

    if (orderResult.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult[0];
    
    // Create consumer notification
    const statusMessages = {
      confirmed: 'Your order has been confirmed by the merchant',
      processing: 'Your order is being processed',
      shipped: 'Your order has been shipped and is on the way',
      delivered: 'Your order has been delivered successfully',
      cancelled: 'Your order has been cancelled'
    };

    const notification = await createNotification({
      userId: order.buyerId,
      userRole: 'CONSUMER',
      title: `Order ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      message: statusMessages[status as keyof typeof statusMessages] || `Your order status has been updated to ${status}`,
      type: 'ORDER_STATUS',
      relatedId: orderId,
      priority: status === 'delivered' || status === 'cancelled' ? 'HIGH' : 'MEDIUM',
      actionUrl: `/orders/${orderId}`,
    });

    res.json({
      message: 'Order status notification sent',
      notification,
    });
  } catch (error) {
    console.error('Order status notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delivery request notification for drivers
router.post('/delivery-request', authenticateToken, authorizeRoles('MERCHANT', 'ADMIN'), async (req, res) => {
  try {
    const { deliveryRequestId, driverIds } = req.body;

    if (!deliveryRequestId || !Array.isArray(driverIds)) {
      return res.status(400).json({ error: 'Delivery request ID and driver IDs array are required' });
    }

    // Get delivery request details
    const deliveryResult = await db.select({
      id: deliveryRequests.id,
      deliveryType: deliveryRequests.deliveryType,
      deliveryFee: deliveryRequests.deliveryFee,
      pickupAddress: deliveryRequests.pickupAddress,
      deliveryAddress: deliveryRequests.deliveryAddress,
      estimatedDistance: deliveryRequests.estimatedDistance,
    })
      .from(deliveryRequests)
      .where(eq(deliveryRequests.id, deliveryRequestId));

    if (deliveryResult.length === 0) {
      return res.status(404).json({ error: 'Delivery request not found' });
    }

    const delivery = deliveryResult[0];
    const notifications = [];

    // Send notification to each driver
    for (const driverId of driverIds) {
      const notification = await createNotification({
        userId: driverId,
        userRole: 'DRIVER',
        title: 'New Delivery Request',
        message: `${delivery.deliveryType} delivery - ₦${delivery.deliveryFee} (${delivery.estimatedDistance}km)`,
        type: 'DELIVERY_REQUEST',
        relatedId: deliveryRequestId,
        priority: 'HIGH',
        actionUrl: `/delivery/requests/${deliveryRequestId}`,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // Expires in 30 minutes
      });
      notifications.push(notification);
    }

    res.json({
      message: 'Delivery request notifications sent',
      notifications,
    });
  } catch (error) {
    console.error('Delivery request notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Payout confirmation notification
router.post('/payout-confirmation', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { userId, userRole, amount, status, payoutId } = req.body;

    if (!userId || !userRole || !amount || !status) {
      return res.status(400).json({ error: 'Required fields: userId, userRole, amount, status' });
    }

    const statusMessages = {
      approved: `Your payout of ₦${amount} has been approved and will be processed within 24 hours`,
      processed: `Your payout of ₦${amount} has been successfully processed`,
      rejected: `Your payout request of ₦${amount} has been rejected`
    };

    const notification = await createNotification({
      userId,
      userRole: userRole as 'MERCHANT' | 'DRIVER',
      title: `Payout ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      message: statusMessages[status as keyof typeof statusMessages] || `Your payout status: ${status}`,
      type: 'PAYOUT_CONFIRMATION',
      relatedId: payoutId,
      priority: 'HIGH',
      actionUrl: `/payment/payout/history`,
    });

    res.json({
      message: 'Payout confirmation notification sent',
      notification,
    });
  } catch (error) {
    console.error('Payout confirmation notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete notification
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    const userRole = (req as any).user.role;

    let notification;

    switch (userRole) {
      case 'CONSUMER':
        notification = await db.select()
          .from(consumerNotifications)
          .where(and(
            eq(consumerNotifications.id, id),
            eq(consumerNotifications.consumerId, userId)
          ));

        if (notification.length === 0) {
          return res.status(404).json({ error: 'Notification not found' });
        }

        await db.delete(consumerNotifications)
          .where(eq(consumerNotifications.id, id));
        break;

      case 'MERCHANT':
        notification = await db.select()
          .from(merchantNotifications)
          .where(and(
            eq(merchantNotifications.id, id),
            eq(merchantNotifications.merchantId, userId)
          ));

        if (notification.length === 0) {
          return res.status(404).json({ error: 'Notification not found' });
        }

        await db.delete(merchantNotifications)
          .where(eq(merchantNotifications.id, id));
        break;

      case 'DRIVER':
        notification = await db.select()
          .from(driverNotifications)
          .where(and(
            eq(driverNotifications.id, id),
            eq(driverNotifications.driverId, userId)
          ));

        if (notification.length === 0) {
          return res.status(404).json({ error: 'Notification not found' });
        }

        await db.delete(driverNotifications)
          .where(eq(driverNotifications.id, id));
        break;
    }

    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export the createNotification utility for use in other routes
export { createNotification };
export default router;
