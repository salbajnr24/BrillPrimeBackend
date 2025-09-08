"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNotification = void 0;
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const database_1 = __importDefault(require("../config/database"));
const schema_1 = require("../schema");
const auth_1 = require("../utils/auth");
const router = (0, express_1.Router)();
// Utility function to create notifications
const createNotification = async (notificationData) => {
    const { userId, userRole, title, message, type, relatedId, priority = 'MEDIUM', actionUrl, expiresAt } = notificationData;
    let notification;
    switch (userRole) {
        case 'CONSUMER':
            notification = await database_1.default.insert(schema_1.consumerNotifications).values({
                consumerId: userId,
                title,
                message,
                type: type,
                relatedId,
                priority,
                actionUrl,
            }).returning();
            break;
        case 'MERCHANT':
            notification = await database_1.default.insert(schema_1.merchantNotifications).values({
                merchantId: userId,
                title,
                message,
                type: type,
                relatedId,
                priority,
                actionUrl,
            }).returning();
            break;
        case 'DRIVER':
            notification = await database_1.default.insert(schema_1.driverNotifications).values({
                driverId: userId,
                title,
                message,
                type: type,
                relatedId,
                priority,
                actionUrl,
                expiresAt,
            }).returning();
            break;
    }
    return notification?.[0];
};
exports.createNotification = createNotification;
// Get notifications for current user (works for all user types)
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const userRole = req.user.role;
        const { isRead, type, page = 1, limit = 20 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        let notifications = [];
        let totalCount = 0;
        switch (userRole) {
            case 'CONSUMER':
                {
                    let whereConditions = [(0, drizzle_orm_1.eq)(schema_1.consumerNotifications.consumerId, userId)];
                    if (isRead !== undefined) {
                        whereConditions.push((0, drizzle_orm_1.eq)(schema_1.consumerNotifications.isRead, isRead === 'true'));
                    }
                    if (type) {
                        whereConditions.push((0, drizzle_orm_1.eq)(schema_1.consumerNotifications.type, type));
                    }
                    notifications = await database_1.default.select()
                        .from(schema_1.consumerNotifications)
                        .where((0, drizzle_orm_1.and)(...whereConditions))
                        .orderBy((0, drizzle_orm_1.desc)(schema_1.consumerNotifications.createdAt))
                        .limit(Number(limit))
                        .offset(offset);
                    const countResult = await database_1.default.select({
                        count: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
                    })
                        .from(schema_1.consumerNotifications)
                        .where((0, drizzle_orm_1.and)(...whereConditions));
                    totalCount = countResult[0]?.count || 0;
                }
                break;
            case 'MERCHANT':
                {
                    let whereConditions = [(0, drizzle_orm_1.eq)(schema_1.merchantNotifications.merchantId, userId)];
                    if (isRead !== undefined) {
                        whereConditions.push((0, drizzle_orm_1.eq)(schema_1.merchantNotifications.isRead, isRead === 'true'));
                    }
                    if (type) {
                        whereConditions.push((0, drizzle_orm_1.eq)(schema_1.merchantNotifications.type, type));
                    }
                    notifications = await database_1.default.select()
                        .from(schema_1.merchantNotifications)
                        .where((0, drizzle_orm_1.and)(...whereConditions))
                        .orderBy((0, drizzle_orm_1.desc)(schema_1.merchantNotifications.createdAt))
                        .limit(Number(limit))
                        .offset(offset);
                    const countResult = await database_1.default.select({
                        count: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
                    })
                        .from(schema_1.merchantNotifications)
                        .where((0, drizzle_orm_1.and)(...whereConditions));
                    totalCount = countResult[0]?.count || 0;
                }
                break;
            case 'DRIVER':
                {
                    let whereConditions = [(0, drizzle_orm_1.eq)(schema_1.driverNotifications.driverId, userId)];
                    if (isRead !== undefined) {
                        whereConditions.push((0, drizzle_orm_1.eq)(schema_1.driverNotifications.isRead, isRead === 'true'));
                    }
                    if (type) {
                        whereConditions.push((0, drizzle_orm_1.eq)(schema_1.driverNotifications.type, type));
                    }
                    notifications = await database_1.default.select()
                        .from(schema_1.driverNotifications)
                        .where((0, drizzle_orm_1.and)(...whereConditions))
                        .orderBy((0, drizzle_orm_1.desc)(schema_1.driverNotifications.createdAt))
                        .limit(Number(limit))
                        .offset(offset);
                    const countResult = await database_1.default.select({
                        count: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
                    })
                        .from(schema_1.driverNotifications)
                        .where((0, drizzle_orm_1.and)(...whereConditions));
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
    }
    catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Mark notification as read
router.put('/:id/read', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const userRole = req.user.role;
        let notification;
        let updatedNotification;
        switch (userRole) {
            case 'CONSUMER':
                notification = await database_1.default.select()
                    .from(schema_1.consumerNotifications)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.consumerNotifications.id, id), (0, drizzle_orm_1.eq)(schema_1.consumerNotifications.consumerId, userId)));
                if (notification.length === 0) {
                    return res.status(404).json({ error: 'Notification not found' });
                }
                updatedNotification = await database_1.default.update(schema_1.consumerNotifications)
                    .set({
                    isRead: true,
                    readAt: new Date(),
                })
                    .where((0, drizzle_orm_1.eq)(schema_1.consumerNotifications.id, id))
                    .returning();
                break;
            case 'MERCHANT':
                notification = await database_1.default.select()
                    .from(schema_1.merchantNotifications)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.merchantNotifications.id, id), (0, drizzle_orm_1.eq)(schema_1.merchantNotifications.merchantId, userId)));
                if (notification.length === 0) {
                    return res.status(404).json({ error: 'Notification not found' });
                }
                updatedNotification = await database_1.default.update(schema_1.merchantNotifications)
                    .set({
                    isRead: true,
                    readAt: new Date(),
                })
                    .where((0, drizzle_orm_1.eq)(schema_1.merchantNotifications.id, id))
                    .returning();
                break;
            case 'DRIVER':
                notification = await database_1.default.select()
                    .from(schema_1.driverNotifications)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.driverNotifications.id, id), (0, drizzle_orm_1.eq)(schema_1.driverNotifications.driverId, userId)));
                if (notification.length === 0) {
                    return res.status(404).json({ error: 'Notification not found' });
                }
                updatedNotification = await database_1.default.update(schema_1.driverNotifications)
                    .set({
                    isRead: true,
                    readAt: new Date(),
                })
                    .where((0, drizzle_orm_1.eq)(schema_1.driverNotifications.id, id))
                    .returning();
                break;
        }
        res.json({
            message: 'Notification marked as read',
            notification: updatedNotification?.[0],
        });
    }
    catch (error) {
        console.error('Mark notification as read error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Mark all notifications as read
router.put('/mark-all-read', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const userRole = req.user.role;
        switch (userRole) {
            case 'CONSUMER':
                await database_1.default.update(schema_1.consumerNotifications)
                    .set({
                    isRead: true,
                    readAt: new Date(),
                })
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.consumerNotifications.consumerId, userId), (0, drizzle_orm_1.eq)(schema_1.consumerNotifications.isRead, false)));
                break;
            case 'MERCHANT':
                await database_1.default.update(schema_1.merchantNotifications)
                    .set({
                    isRead: true,
                    readAt: new Date(),
                })
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.merchantNotifications.merchantId, userId), (0, drizzle_orm_1.eq)(schema_1.merchantNotifications.isRead, false)));
                break;
            case 'DRIVER':
                await database_1.default.update(schema_1.driverNotifications)
                    .set({
                    isRead: true,
                    readAt: new Date(),
                })
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.driverNotifications.driverId, userId), (0, drizzle_orm_1.eq)(schema_1.driverNotifications.isRead, false)));
                break;
        }
        res.json({ message: 'All notifications marked as read' });
    }
    catch (error) {
        console.error('Mark all notifications as read error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get unread notifications count
router.get('/unread-count', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const userRole = req.user.role;
        let countResult;
        switch (userRole) {
            case 'CONSUMER':
                countResult = await database_1.default.select({
                    count: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
                })
                    .from(schema_1.consumerNotifications)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.consumerNotifications.consumerId, userId), (0, drizzle_orm_1.eq)(schema_1.consumerNotifications.isRead, false)));
                break;
            case 'MERCHANT':
                countResult = await database_1.default.select({
                    count: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
                })
                    .from(schema_1.merchantNotifications)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.merchantNotifications.merchantId, userId), (0, drizzle_orm_1.eq)(schema_1.merchantNotifications.isRead, false)));
                break;
            case 'DRIVER':
                countResult = await database_1.default.select({
                    count: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
                })
                    .from(schema_1.driverNotifications)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.driverNotifications.driverId, userId), (0, drizzle_orm_1.eq)(schema_1.driverNotifications.isRead, false)));
                break;
        }
        res.json({
            unreadCount: countResult?.[0]?.count || 0,
            userRole
        });
    }
    catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Create notification (internal API for system use)
router.post('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const { userId, userRole, title, message, type, relatedId, priority = 'MEDIUM', actionUrl, expiresAt, } = req.body;
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
    }
    catch (error) {
        console.error('Create notification error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Order status notification triggers
router.post('/order-status', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('MERCHANT', 'DRIVER', 'ADMIN'), async (req, res) => {
    try {
        const { orderId, status } = req.body;
        if (!orderId || !status) {
            return res.status(400).json({ error: 'Order ID and status are required' });
        }
        // Get order details
        const orderResult = await database_1.default.select({
            buyerId: schema_1.orders.buyerId,
            sellerId: schema_1.orders.sellerId,
            productName: (0, drizzle_orm_1.sql) `'Order #' || ${schema_1.orders.id}`,
            status: schema_1.orders.status,
        })
            .from(schema_1.orders)
            .where((0, drizzle_orm_1.eq)(schema_1.orders.id, orderId));
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
            message: statusMessages[status] || `Your order status has been updated to ${status}`,
            type: 'ORDER_STATUS',
            relatedId: orderId,
            priority: status === 'delivered' || status === 'cancelled' ? 'HIGH' : 'MEDIUM',
            actionUrl: `/orders/${orderId}`,
        });
        res.json({
            message: 'Order status notification sent',
            notification,
        });
    }
    catch (error) {
        console.error('Order status notification error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Delivery request notification for drivers
router.post('/delivery-request', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('MERCHANT', 'ADMIN'), async (req, res) => {
    try {
        const { deliveryRequestId, driverIds } = req.body;
        if (!deliveryRequestId || !Array.isArray(driverIds)) {
            return res.status(400).json({ error: 'Delivery request ID and driver IDs array are required' });
        }
        // Get delivery request details
        const deliveryResult = await database_1.default.select({
            id: schema_1.deliveryRequests.id,
            deliveryType: schema_1.deliveryRequests.deliveryType,
            deliveryFee: schema_1.deliveryRequests.deliveryFee,
            pickupAddress: schema_1.deliveryRequests.pickupAddress,
            deliveryAddress: schema_1.deliveryRequests.deliveryAddress,
            estimatedDistance: schema_1.deliveryRequests.estimatedDistance,
        })
            .from(schema_1.deliveryRequests)
            .where((0, drizzle_orm_1.eq)(schema_1.deliveryRequests.id, deliveryRequestId));
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
    }
    catch (error) {
        console.error('Delivery request notification error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Payout confirmation notification
router.post('/payout-confirmation', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('ADMIN'), async (req, res) => {
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
            userRole: userRole,
            title: `Payout ${status.charAt(0).toUpperCase() + status.slice(1)}`,
            message: statusMessages[status] || `Your payout status: ${status}`,
            type: 'PAYOUT_CONFIRMATION',
            relatedId: payoutId,
            priority: 'HIGH',
            actionUrl: `/payment/payout/history`,
        });
        res.json({
            message: 'Payout confirmation notification sent',
            notification,
        });
    }
    catch (error) {
        console.error('Payout confirmation notification error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Delete notification
router.delete('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const userRole = req.user.role;
        let notification;
        switch (userRole) {
            case 'CONSUMER':
                notification = await database_1.default.select()
                    .from(schema_1.consumerNotifications)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.consumerNotifications.id, id), (0, drizzle_orm_1.eq)(schema_1.consumerNotifications.consumerId, userId)));
                if (notification.length === 0) {
                    return res.status(404).json({ error: 'Notification not found' });
                }
                await database_1.default.delete(schema_1.consumerNotifications)
                    .where((0, drizzle_orm_1.eq)(schema_1.consumerNotifications.id, id));
                break;
            case 'MERCHANT':
                notification = await database_1.default.select()
                    .from(schema_1.merchantNotifications)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.merchantNotifications.id, id), (0, drizzle_orm_1.eq)(schema_1.merchantNotifications.merchantId, userId)));
                if (notification.length === 0) {
                    return res.status(404).json({ error: 'Notification not found' });
                }
                await database_1.default.delete(schema_1.merchantNotifications)
                    .where((0, drizzle_orm_1.eq)(schema_1.merchantNotifications.id, id));
                break;
            case 'DRIVER':
                notification = await database_1.default.select()
                    .from(schema_1.driverNotifications)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.driverNotifications.id, id), (0, drizzle_orm_1.eq)(schema_1.driverNotifications.driverId, userId)));
                if (notification.length === 0) {
                    return res.status(404).json({ error: 'Notification not found' });
                }
                await database_1.default.delete(schema_1.driverNotifications)
                    .where((0, drizzle_orm_1.eq)(schema_1.driverNotifications.id, id));
                break;
        }
        res.json({ message: 'Notification deleted successfully' });
    }
    catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=notifications.js.map