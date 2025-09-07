import { Router } from 'express';
import { eq, and, desc, sql } from 'drizzle-orm';
import db from '../config/database';
import { merchantNotifications } from '../schema';
import { authenticateToken, authorizeRoles } from '../utils/auth';

const router = Router();

// Get merchant notifications
router.get('/', authenticateToken, authorizeRoles('MERCHANT'), async (req, res) => {
  try {
    const merchantId = (req as any).user.userId;
    const { isRead, type, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereConditions = [eq(merchantNotifications.merchantId, merchantId)];

    if (isRead !== undefined) {
      whereConditions.push(eq(merchantNotifications.isRead, isRead === 'true'));
    }

    if (type) {
      whereConditions.push(eq(merchantNotifications.type, type as any));
    }

    const notifications = await db.select()
      .from(merchantNotifications)
      .where(and(...whereConditions))
      .orderBy(desc(merchantNotifications.createdAt))
      .limit(Number(limit))
      .offset(offset);

    // Get total count for pagination
    const totalCountResult = await db.select({
      count: sql<number>`count(*)`.mapWith(Number),
    })
      .from(merchantNotifications)
      .where(and(...whereConditions));

    const totalCount = totalCountResult[0]?.count || 0;

    res.json({
      notifications,
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
router.put('/:id/read', authenticateToken, authorizeRoles('MERCHANT'), async (req, res) => {
  try {
    const { id } = req.params;
    const merchantId = (req as any).user.userId;

    // Check if notification belongs to the merchant
    const notification = await db.select()
      .from(merchantNotifications)
      .where(and(
        eq(merchantNotifications.id, id),
        eq(merchantNotifications.merchantId, merchantId)
      ));

    if (notification.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const updatedNotification = await db.update(merchantNotifications)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(eq(merchantNotifications.id, id))
      .returning();

    res.json({
      message: 'Notification marked as read',
      notification: updatedNotification[0],
    });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark all notifications as read
router.put('/mark-all-read', authenticateToken, authorizeRoles('MERCHANT'), async (req, res) => {
  try {
    const merchantId = (req as any).user.userId;

    await db.update(merchantNotifications)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(and(
        eq(merchantNotifications.merchantId, merchantId),
        eq(merchantNotifications.isRead, false)
      ));

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get unread notifications count
router.get('/unread-count', authenticateToken, authorizeRoles('MERCHANT'), async (req, res) => {
  try {
    const merchantId = (req as any).user.userId;

    const countResult = await db.select({
      count: sql<number>`count(*)`.mapWith(Number),
    })
      .from(merchantNotifications)
      .where(and(
        eq(merchantNotifications.merchantId, merchantId),
        eq(merchantNotifications.isRead, false)
      ));

    res.json({ unreadCount: countResult[0]?.count || 0 });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create notification (internal API for system use)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      merchantId,
      title,
      message,
      type,
      relatedId,
      priority = 'MEDIUM',
      actionUrl,
    } = req.body;

    if (!merchantId || !title || !message || !type) {
      return res.status(400).json({ error: 'Required fields: merchantId, title, message, type' });
    }

    const notification = await db.insert(merchantNotifications).values({
      merchantId,
      title,
      message,
      type: type as any,
      relatedId,
      priority: priority as any,
      actionUrl,
    }).returning();

    res.status(201).json({
      message: 'Notification created successfully',
      notification: notification[0],
    });
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete notification
router.delete('/:id', authenticateToken, authorizeRoles('MERCHANT'), async (req, res) => {
  try {
    const { id } = req.params;
    const merchantId = (req as any).user.userId;

    // Check if notification belongs to the merchant
    const notification = await db.select()
      .from(merchantNotifications)
      .where(and(
        eq(merchantNotifications.id, id),
        eq(merchantNotifications.merchantId, merchantId)
      ));

    if (notification.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await db.delete(merchantNotifications)
      .where(eq(merchantNotifications.id, id));

    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;