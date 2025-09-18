import { Router } from 'express';
import { eq, and, desc, sql, or } from 'drizzle-orm';
import db from '../config/database';
import { 
  merchantNotifications, 
  consumerNotifications, 
  driverNotifications,
  orders,
  deliveryRequests,
  users,
  notificationPreferences,
  notificationTemplates,
  scheduledNotifications
} from '../schema';
import { authenticateToken, authorizeRoles } from '../utils/auth';
import { Message } from '../utils/messages';

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

// Update notification preferences
router.post('/preferences', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const userRole = (req as any).user.role;
    const { preferences } = req.body;

    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({ error: 'Valid preferences object is required' });
    }

    // In production, you'd save these to a user_notification_preferences table
    const userPreferences = {
      userId,
      userRole,
      emailNotifications: preferences.email || true,
      pushNotifications: preferences.push || true,
      smsNotifications: preferences.sms || false,
      categories: preferences.categories || {
        order_updates: true,
        delivery_updates: true,
        promotions: false,
        system_alerts: true
      },
      frequency: preferences.frequency || 'immediate',
      quietHours: preferences.quietHours || { start: '22:00', end: '07:00' },
      updatedAt: new Date()
    };

    await db.insert(notificationPreferences).values({
      userId,
      userRole,
      emailNotifications: userPreferences.emailNotifications,
      pushNotifications: userPreferences.pushNotifications,
      smsNotifications: userPreferences.smsNotifications,
      categories: userPreferences.categories as any,
      frequency: userPreferences.frequency,
      quietHours: userPreferences.quietHours as any,
      updatedAt: userPreferences.updatedAt
    }).onConflictDoUpdate({
      target: [notificationPreferences.userId, notificationPreferences.userRole],
      set: {
        emailNotifications: userPreferences.emailNotifications,
        pushNotifications: userPreferences.pushNotifications,
        smsNotifications: userPreferences.smsNotifications,
        categories: userPreferences.categories as any,
        frequency: userPreferences.frequency,
        quietHours: userPreferences.quietHours as any,
        updatedAt: userPreferences.updatedAt
      }
    });


    res.json({
      message: 'Notification preferences updated successfully',
      preferences: userPreferences
    });
  } catch (error) {
    console.error('Update notification preferences error:', error);
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
});

// Send bulk notifications
router.post('/batch-send', authenticateToken, authorizeRoles('ADMIN', 'MERCHANT'), async (req, res) => {
  try {
    const senderId = (req as any).user.userId;
    const senderRole = (req as any).user.role;
    const { recipients, message, type = 'SYSTEM', priority = 'MEDIUM' } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'Recipients array is required' });
    }

    if (!message || !message.title || !message.body) {
      return res.status(400).json({ error: 'Message title and body are required' });
    }

    const batchResults = [];

    for (const recipient of recipients) {
      try {
        const notification = await createNotification({
          userId: recipient.userId,
          userRole: recipient.userRole,
          title: message.title,
          message: message.body,
          type,
          priority,
          actionUrl: message.actionUrl,
        });

        batchResults.push({
          userId: recipient.userId,
          status: 'sent',
          notificationId: notification?.id
        });
      } catch (error) {
        batchResults.push({
          userId: recipient.userId,
          status: 'failed',
          error: (error as Error).message
        });
      }
    }

    const successCount = batchResults.filter(r => r.status === 'sent').length;
    const failureCount = batchResults.filter(r => r.status === 'failed').length;

    res.json({
      message: 'Batch notification processing completed',
      results: {
        total: recipients.length,
        successful: successCount,
        failed: failureCount,
        details: batchResults
      },
      batchId: `batch_${Date.now()}_${senderId}`
    });
  } catch (error) {
    console.error('Batch send notifications error:', error);
    res.status(500).json({ error: 'Failed to send batch notifications' });
  }
});

// Get notification templates
router.get('/templates', authenticateToken, authorizeRoles('ADMIN', 'MERCHANT'), async (req, res) => {
  try {
    const { category, type } = req.query;

    const templates = [
      {
        id: 'order_confirmed',
        name: 'Order Confirmed',
        category: 'orders',
        type: 'ORDER_STATUS',
        template: {
          title: 'Order Confirmed - #{orderNumber}',
          body: 'Your order has been confirmed and is being prepared by {merchantName}.',
          variables: ['orderNumber', 'merchantName', 'estimatedTime'],
          actionUrl: '/orders/{orderId}'
        }
      },
      {
        id: 'delivery_assigned',
        name: 'Driver Assigned',
        category: 'delivery',
        type: 'DELIVERY_UPDATE',
        template: {
          title: 'Driver Assigned',
          body: '{driverName} has been assigned to deliver your order. Track your delivery now.',
          variables: ['driverName', 'driverPhone', 'estimatedArrival'],
          actionUrl: '/track/{trackingNumber}'
        }
      },
      {
        id: 'payment_received',
        name: 'Payment Received',
        category: 'payments',
        type: 'PAYMENT',
        template: {
          title: 'Payment Received',
          body: 'We have received your payment of ₦{amount}. Your order will be processed shortly.',
          variables: ['amount', 'paymentMethod', 'transactionId'],
          actionUrl: '/payment/receipt/{transactionId}'
        }
      },
      {
        id: 'promotion_alert',
        name: 'Promotion Alert',
        category: 'marketing',
        type: 'PROMOTION',
        template: {
          title: 'Special Offer Just for You!',
          body: 'Get {discount}% off on {category} items. Use code: {promoCode}',
          variables: ['discount', 'category', 'promoCode', 'validUntil'],
          actionUrl: '/promotions/{promoId}'
        }
      },
      {
        id: 'low_stock_alert',
        name: 'Low Stock Alert',
        category: 'inventory',
        type: 'SYSTEM',
        template: {
          title: 'Low Stock Alert',
          body: 'Your product "{productName}" is running low. Current stock: {currentStock}',
          variables: ['productName', 'currentStock', 'minimumThreshold'],
          actionUrl: '/merchant/inventory/{productId}'
        }
      }
    ];

    let filteredTemplates = templates;

    if (category) {
      filteredTemplates = filteredTemplates.filter(t => t.category === category);
    }

    if (type) {
      filteredTemplates = filteredTemplates.filter(t => t.type === type);
    }

    res.json({
      templates: filteredTemplates,
      categories: [...new Set(templates.map(t => t.category))],
      types: [...new Set(templates.map(t => t.type))]
    });
  } catch (error) {
    console.error('Get notification templates error:', error);
    res.status(500).json({ error: 'Failed to get notification templates' });
  }
});

// Schedule future notifications
router.post('/schedule', authenticateToken, authorizeRoles('ADMIN', 'MERCHANT'), async (req, res) => {
  try {
    const schedulerId = (req as any).user.userId;
    const { 
      recipients, 
      message, 
      scheduleTime, 
      templateId, 
      templateVariables = {},
      type = 'SYSTEM',
      priority = 'MEDIUM' 
    } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'Recipients array is required' });
    }

    if (!scheduleTime) {
      return res.status(400).json({ error: 'Schedule time is required' });
    }

    const scheduledTime = new Date(scheduleTime);
    if (scheduledTime <= new Date()) {
      return res.status(400).json({ error: 'Schedule time must be in the future' });
    }

    if (!message && !templateId) {
      return res.status(400).json({ error: 'Either message or templateId is required' });
    }

    // Create scheduled notification record
    const scheduledNotification = {
      id: `scheduled_${Date.now()}_${schedulerId}`,
      schedulerId,
      recipients,
      message: message || null,
      templateId: templateId || null,
      templateVariables,
      scheduleTime: scheduledTime,
      type,
      priority,
      status: 'scheduled',
      createdAt: new Date()
    };

    await db.insert(scheduledNotifications).values({
      id: scheduledNotification.id,
      schedulerId: scheduledNotification.schedulerId,
      recipients: JSON.stringify(scheduledNotification.recipients),
      message: scheduledNotification.message ? JSON.stringify(scheduledNotification.message) : null,
      templateId: scheduledNotification.templateId,
      templateVariables: JSON.stringify(scheduledNotification.templateVariables),
      scheduleTime: scheduledNotification.scheduleTime,
      type: scheduledNotification.type,
      priority: scheduledNotification.priority,
      status: scheduledNotification.status,
      createdAt: scheduledNotification.createdAt
    });

    res.status(201).json({
      message: 'Notification scheduled successfully',
      scheduledNotification: {
        id: scheduledNotification.id,
        scheduledFor: scheduledTime,
        recipientCount: recipients.length,
        status: 'scheduled'
      }
    });
  } catch (error) {
    console.error('Schedule notification error:', error);
    res.status(500).json({ error: 'Failed to schedule notification' });
  }
});

// Get user notification preferences
router.get('/preferences', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const userRole = (req as any).user.role;

    const preferences = await db.select()
      .from(notificationPreferences)
      .where(and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.userRole, userRole)
      ));

    if (preferences.length > 0) {
      return res.json({ preferences: preferences[0] });
    }

    // If no preferences found, return defaults
    const defaultPreferences = {
      userId,
      userRole,
      emailNotifications: true,
      pushNotifications: true,
      smsNotifications: false,
      categories: {
        order_updates: true,
        delivery_updates: true,
        promotions: false,
        system_alerts: true,
        payment_updates: true,
        security_alerts: true
      },
      frequency: 'immediate', // immediate, hourly, daily
      quietHours: { start: '22:00', end: '07:00' },
      language: 'en'
    };

    res.json({ preferences: defaultPreferences });
  } catch (error) {
    console.error('Get notification preferences error:', error);
    res.status(500).json({ error: 'Failed to get notification preferences' });
  }
});

// Search for notifications (example implementation)
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const userRole = (req as any).user.role;
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    let searchResults: any[] = [];

    switch (userRole) {
      case 'CONSUMER':
        searchResults = await db.select()
          .from(consumerNotifications)
          .where(and(
            eq(consumerNotifications.consumerId, userId),
            or(
              sql`${consumerNotifications.title} ILIKE ${`%${query}%`}`,
              sql`${consumerNotifications.message} ILIKE ${`%${query}%`}`
            )
          ))
          .limit(10);
        break;
      case 'MERCHANT':
        searchResults = await db.select()
          .from(merchantNotifications)
          .where(and(
            eq(merchantNotifications.merchantId, userId),
            or(
              sql`${merchantNotifications.title} ILIKE ${`%${query}%`}`,
              sql`${merchantNotifications.message} ILIKE ${`%${query}%`}`
            )
          ))
          .limit(10);
        break;
      case 'DRIVER':
        searchResults = await db.select()
          .from(driverNotifications)
          .where(and(
            eq(driverNotifications.driverId, userId),
            or(
              sql`${driverNotifications.title} ILIKE ${`%${query}%`}`,
              sql`${driverNotifications.message} ILIKE ${`%${query}%`}`
            )
          ))
          .limit(10);
        break;
    }

    res.json({ searchResults });
  } catch (error) {
    console.error('Search notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all notification templates (for admin)
router.get('/templates/all', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const templates = await db.select().from(notificationTemplates);
    res.json({ templates });
  } catch (error) {
    console.error('Get all notification templates error:', error);
    res.status(500).json({ error: 'Failed to get all notification templates' });
  }
});

// Create a new notification template (for admin)
router.post('/templates', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { name, category, type, template } = req.body;

    if (!name || !category || !type || !template || !template.title || !template.body) {
      return res.status(400).json({ error: 'Missing required fields for template creation' });
    }

    const newTemplate = await db.insert(notificationTemplates).values({
      name,
      category,
      type,
      template: template as any,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();

    res.status(201).json({ message: 'Notification template created successfully', template: newTemplate[0] });
  } catch (error) {
    console.error('Create notification template error:', error);
    res.status(500).json({ error: 'Failed to create notification template' });
  }
});

// Update an existing notification template (for admin)
router.put('/templates/:id', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, type, template } = req.body;

    if (!name && !category && !type && !template) {
      return res.status(400).json({ error: 'No fields provided for update' });
    }

    const updateData: any = { updatedAt: new Date() };
    if (name) updateData.name = name;
    if (category) updateData.category = category;
    if (type) updateData.type = type;
    if (template) updateData.template = template as any;

    const updatedTemplate = await db.update(notificationTemplates)
      .set(updateData)
      .where(eq(notificationTemplates.id, id))
      .returning();

    if (updatedTemplate.length === 0) {
      return res.status(404).json({ error: 'Notification template not found' });
    }

    res.json({ message: 'Notification template updated successfully', template: updatedTemplate[0] });
  } catch (error) {
    console.error('Update notification template error:', error);
    res.status(500).json({ error: 'Failed to update notification template' });
  }
});

// Delete a notification template (for admin)
router.delete('/templates/:id', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    const deletedTemplate = await db.delete(notificationTemplates)
      .where(eq(notificationTemplates.id, id))
      .returning();

    if (deletedTemplate.length === 0) {
      return res.status(404).json({ error: 'Notification template not found' });
    }

    res.json({ message: 'Notification template deleted successfully' });
  } catch (error) {
    console.error('Delete notification template error:', error);
    res.status(500).json({ error: 'Failed to delete notification template' });
  }
});

// Get scheduled notifications
router.get('/scheduled', authenticateToken, authorizeRoles('ADMIN', 'MERCHANT'), async (req, res) => {
  try {
    const { status, scheduleTime } = req.query;
    let whereConditions: any[] = [];

    if (status) {
      whereConditions.push(eq(scheduledNotifications.status, status as string));
    }
    if (scheduleTime) {
      whereConditions.push(eq(scheduledNotifications.scheduleTime, new Date(scheduleTime as string)));
    }

    const scheduledNotificationsList = await db.select()
      .from(scheduledNotifications)
      .where(and(...whereConditions));

    // Parse JSON fields
    const parsedNotifications = scheduledNotificationsList.map(n => ({
      ...n,
      recipients: JSON.parse(n.recipients),
      message: n.message ? JSON.parse(n.message) : null,
      templateVariables: JSON.parse(n.templateVariables),
    }));

    res.json({ scheduledNotifications: parsedNotifications });
  } catch (error) {
    console.error('Get scheduled notifications error:', error);
    res.status(500).json({ error: 'Failed to get scheduled notifications' });
  }
});

// Update scheduled notification status (e.g., retry, cancel)
router.put('/scheduled/:id/status', authenticateToken, authorizeRoles('ADMIN', 'MERCHANT'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const updatedNotification = await db.update(scheduledNotifications)
      .set({ status })
      .where(eq(scheduledNotifications.id, id))
      .returning();

    if (updatedNotification.length === 0) {
      return res.status(404).json({ error: 'Scheduled notification not found' });
    }

    res.json({ message: 'Scheduled notification status updated successfully', notification: updatedNotification[0] });
  } catch (error) {
    console.error('Update scheduled notification status error:', error);
    res.status(500).json({ error: 'Failed to update scheduled notification status' });
  }
});

// Example of using the Message enum for responses
router.get('/example', authenticateToken, (req, res) => {
  res.json({ message: Message.userProfile });
});

// Export the createNotification utility for use in other routes
export { createNotification };
export default router;