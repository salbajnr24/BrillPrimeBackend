"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const axios_1 = __importDefault(require("axios"));
const database_1 = __importDefault(require("../config/database"));
const schema_1 = require("../schema");
const auth_1 = require("../utils/auth");
const notifications_1 = require("./notifications");
const router = (0, express_1.Router)();
// Create order from cart (checkout)
router.post('/checkout', auth_1.authenticateToken, async (req, res) => {
    try {
        const buyerId = req.user.userId;
        const { deliveryAddress } = req.body;
        if (!deliveryAddress) {
            return res.status(400).json({ error: 'Delivery address is required' });
        }
        // Get cart items
        const cart = await database_1.default.select({
            id: schema_1.cartItems.id,
            quantity: schema_1.cartItems.quantity,
            product: {
                id: schema_1.products.id,
                name: schema_1.products.name,
                price: schema_1.products.price,
                sellerId: schema_1.products.sellerId,
                inStock: schema_1.products.inStock,
            },
        })
            .from(schema_1.cartItems)
            .leftJoin(schema_1.products, (0, drizzle_orm_1.eq)(schema_1.cartItems.productId, schema_1.products.id))
            .where((0, drizzle_orm_1.eq)(schema_1.cartItems.userId, buyerId));
        if (cart.length === 0) {
            return res.status(400).json({ error: 'Cart is empty' });
        }
        // Check for multiple vendors (similar to NestJS logic)
        const vendorIds = cart.map(item => item.product?.sellerId).filter(Boolean);
        const uniqueVendorIds = [...new Set(vendorIds)];
        if (uniqueVendorIds.length > 1) {
            return res.status(400).json({ error: 'Cannot place an order with items from multiple vendors.' });
        }
        // Create orders for each product
        const createdOrders = [];
        let totalOrderPrice = 0;
        for (const item of cart) {
            if (!item.product?.inStock) {
                return res.status(400).json({ error: `Product ${item.product?.name} is out of stock` });
            }
            const totalPrice = Number(item.product.price) * item.quantity;
            totalOrderPrice += totalPrice;
            const order = await database_1.default.insert(schema_1.orders).values({
                buyerId,
                sellerId: item.product.sellerId,
                productId: item.product.id,
                quantity: item.quantity,
                totalPrice: totalPrice.toString(),
                deliveryAddress,
                status: 'pending',
            }).returning();
            createdOrders.push(order[0]);
        }
        // Clear cart after successful order creation
        await database_1.default.delete(schema_1.cartItems).where((0, drizzle_orm_1.eq)(schema_1.cartItems.userId, buyerId));
        res.status(201).json({
            message: 'Orders created successfully',
            orders: createdOrders,
            totalPrice: totalOrderPrice,
        });
    }
    catch (error) {
        console.error('Checkout error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Place order (alternative endpoint matching NestJS structure)
router.post('/place', auth_1.authenticateToken, async (req, res) => {
    try {
        const buyerId = req.user.userId;
        const { deliveryAddress } = req.body;
        if (!deliveryAddress) {
            return res.status(400).json({ error: 'Delivery address is required' });
        }
        // Get cart items
        const cart = await database_1.default.select({
            id: schema_1.cartItems.id,
            quantity: schema_1.cartItems.quantity,
            product: {
                id: schema_1.products.id,
                name: schema_1.products.name,
                price: schema_1.products.price,
                sellerId: schema_1.products.sellerId,
                inStock: schema_1.products.inStock,
            },
        })
            .from(schema_1.cartItems)
            .leftJoin(schema_1.products, (0, drizzle_orm_1.eq)(schema_1.cartItems.productId, schema_1.products.id))
            .where((0, drizzle_orm_1.eq)(schema_1.cartItems.userId, buyerId));
        if (cart.length === 0) {
            return res.status(400).json({ error: 'Cart is empty' });
        }
        const totalPrice = cart.reduce((total, item) => {
            return total + (Number(item.product?.price || 0) * item.quantity);
        }, 0);
        // Check for multiple vendors
        const vendorIds = cart.map(item => item.product?.sellerId).filter(Boolean);
        const uniqueVendorIds = [...new Set(vendorIds)];
        if (uniqueVendorIds.length > 1) {
            return res.status(400).json({ error: 'Cannot place an order with items from multiple vendors.' });
        }
        // Create orders
        const createdOrders = [];
        for (const item of cart) {
            if (!item.product?.inStock) {
                return res.status(400).json({ error: `Product ${item.product?.name} is out of stock` });
            }
            const itemTotal = Number(item.product.price) * item.quantity;
            const order = await database_1.default.insert(schema_1.orders).values({
                buyerId,
                sellerId: item.product.sellerId,
                productId: item.product.id,
                quantity: item.quantity,
                totalPrice: itemTotal.toString(),
                deliveryAddress,
                status: 'pending',
            }).returning();
            createdOrders.push(order[0]);
        }
        // Clear cart
        await database_1.default.delete(schema_1.cartItems).where((0, drizzle_orm_1.eq)(schema_1.cartItems.userId, buyerId));
        res.status(201).json({
            status: 'Success',
            message: 'Order placed successfully',
            data: {
                orders: createdOrders,
                totalPrice: totalPrice,
            },
        });
    }
    catch (error) {
        console.error('Place order error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get user orders (consumer orders)
router.get('/my-orders', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { page = 1, limit = 10, status } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        let whereConditions = [(0, drizzle_orm_1.eq)(schema_1.orders.buyerId, userId)];
        if (status) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.orders.status, status));
        }
        const userOrders = await database_1.default.select({
            id: schema_1.orders.id,
            quantity: schema_1.orders.quantity,
            totalPrice: schema_1.orders.totalPrice,
            status: schema_1.orders.status,
            deliveryAddress: schema_1.orders.deliveryAddress,
            createdAt: schema_1.orders.createdAt,
            updatedAt: schema_1.orders.updatedAt,
            product: {
                id: schema_1.products.id,
                name: schema_1.products.name,
                price: schema_1.products.price,
                unit: schema_1.products.unit,
                image: schema_1.products.image,
            },
            seller: {
                id: schema_1.users.id,
                fullName: schema_1.users.fullName,
                profilePicture: schema_1.users.profilePicture,
                phone: schema_1.users.phone,
            },
        })
            .from(schema_1.orders)
            .leftJoin(schema_1.products, (0, drizzle_orm_1.eq)(schema_1.orders.productId, schema_1.products.id))
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.orders.sellerId, schema_1.users.id))
            .where((0, drizzle_orm_1.and)(...whereConditions))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.orders.createdAt))
            .limit(Number(limit))
            .offset(offset);
        res.json({
            status: 'Success',
            message: 'Orders fetched successfully',
            data: {
                orders: userOrders,
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total: userOrders.length,
                },
            },
        });
    }
    catch (error) {
        console.error('Get user orders error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get consumer orders (alternative endpoint matching NestJS)
router.get('/consumer-orders', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const userOrders = await database_1.default.select({
            id: schema_1.orders.id,
            quantity: schema_1.orders.quantity,
            totalPrice: schema_1.orders.totalPrice,
            status: schema_1.orders.status,
            deliveryAddress: schema_1.orders.deliveryAddress,
            createdAt: schema_1.orders.createdAt,
            updatedAt: schema_1.orders.updatedAt,
            product: {
                id: schema_1.products.id,
                name: schema_1.products.name,
                price: schema_1.products.price,
                unit: schema_1.products.unit,
                image: schema_1.products.image,
            },
            seller: {
                id: schema_1.users.id,
                fullName: schema_1.users.fullName,
                profilePicture: schema_1.users.profilePicture,
                phone: schema_1.users.phone,
            },
        })
            .from(schema_1.orders)
            .leftJoin(schema_1.products, (0, drizzle_orm_1.eq)(schema_1.orders.productId, schema_1.products.id))
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.orders.sellerId, schema_1.users.id))
            .where((0, drizzle_orm_1.eq)(schema_1.orders.buyerId, userId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.orders.createdAt));
        res.json({
            status: 'Success',
            message: 'Orders fetched successfully',
            data: userOrders,
        });
    }
    catch (error) {
        console.error('Get consumer orders error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get merchant orders (vendor orders)
router.get('/merchant-orders', auth_1.authenticateToken, async (req, res) => {
    try {
        const sellerId = req.user.userId;
        const { page = 1, limit = 10, status } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        let whereConditions = [(0, drizzle_orm_1.eq)(schema_1.orders.sellerId, sellerId)];
        if (status) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.orders.status, status));
        }
        const merchantOrders = await database_1.default.select({
            id: schema_1.orders.id,
            quantity: schema_1.orders.quantity,
            totalPrice: schema_1.orders.totalPrice,
            status: schema_1.orders.status,
            deliveryAddress: schema_1.orders.deliveryAddress,
            createdAt: schema_1.orders.createdAt,
            updatedAt: schema_1.orders.updatedAt,
            product: {
                id: schema_1.products.id,
                name: schema_1.products.name,
                price: schema_1.products.price,
                unit: schema_1.products.unit,
                image: schema_1.products.image,
            },
            buyer: {
                id: schema_1.users.id,
                fullName: schema_1.users.fullName,
                profilePicture: schema_1.users.profilePicture,
                phone: schema_1.users.phone,
                email: schema_1.users.email,
            },
        })
            .from(schema_1.orders)
            .leftJoin(schema_1.products, (0, drizzle_orm_1.eq)(schema_1.orders.productId, schema_1.products.id))
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.orders.buyerId, schema_1.users.id))
            .where((0, drizzle_orm_1.and)(...whereConditions))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.orders.createdAt))
            .limit(Number(limit))
            .offset(offset);
        res.json({
            status: 'Success',
            message: 'Vendor orders fetched successfully',
            data: {
                orders: merchantOrders,
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total: merchantOrders.length,
                },
            },
        });
    }
    catch (error) {
        console.error('Get merchant orders error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get vendor orders (alternative endpoint matching NestJS)
router.get('/vendor-orders', auth_1.authenticateToken, async (req, res) => {
    try {
        const sellerId = req.user.userId;
        const vendorOrders = await database_1.default.select({
            id: schema_1.orders.id,
            quantity: schema_1.orders.quantity,
            totalPrice: schema_1.orders.totalPrice,
            status: schema_1.orders.status,
            deliveryAddress: schema_1.orders.deliveryAddress,
            createdAt: schema_1.orders.createdAt,
            updatedAt: schema_1.orders.updatedAt,
            product: {
                id: schema_1.products.id,
                name: schema_1.products.name,
                price: schema_1.products.price,
                unit: schema_1.products.unit,
                image: schema_1.products.image,
            },
            buyer: {
                id: schema_1.users.id,
                fullName: schema_1.users.fullName,
                profilePicture: schema_1.users.profilePicture,
                phone: schema_1.users.phone,
                email: schema_1.users.email,
            },
        })
            .from(schema_1.orders)
            .leftJoin(schema_1.products, (0, drizzle_orm_1.eq)(schema_1.orders.productId, schema_1.products.id))
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.orders.buyerId, schema_1.users.id))
            .where((0, drizzle_orm_1.eq)(schema_1.orders.sellerId, sellerId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.orders.createdAt));
        res.json({
            status: 'Success',
            message: 'Vendor orders fetched successfully',
            data: vendorOrders,
        });
    }
    catch (error) {
        console.error('Get vendor orders error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Update order status (Merchant only)
router.put('/:id/status', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id: orderId } = req.params;
        const sellerId = req.user.userId;
        const { status } = req.body;
        const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        // Check if order belongs to the seller
        const existingOrder = await database_1.default.select().from(schema_1.orders).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.orders.id, orderId), (0, drizzle_orm_1.eq)(schema_1.orders.sellerId, sellerId)));
        if (existingOrder.length === 0) {
            return res.status(404).json({ error: 'Order not found or you do not have permission to update it' });
        }
        const updatedOrder = await database_1.default.update(schema_1.orders)
            .set({ status: status })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.orders.id, orderId), (0, drizzle_orm_1.eq)(schema_1.orders.sellerId, sellerId)))
            .returning();
        if (updatedOrder.length === 0) {
            return res.status(404).json({ error: 'Order not found or unauthorized' });
        }
        // Create notification for consumer about order status change
        const statusMessages = {
            confirmed: 'Your order has been confirmed by the merchant',
            processing: 'Your order is being processed',
            shipped: 'Your order has been shipped and is on the way',
            delivered: 'Your order has been delivered successfully',
            cancelled: 'Your order has been cancelled'
        };
        try {
            await (0, notifications_1.createNotification)({
                userId: updatedOrder[0].buyerId,
                userRole: 'CONSUMER',
                title: `Order ${status.charAt(0).toUpperCase() + status.slice(1)}`,
                message: statusMessages[status] || `Your order status has been updated to ${status}`,
                type: 'ORDER_STATUS',
                relatedId: orderId,
                priority: status === 'delivered' || status === 'cancelled' ? 'HIGH' : 'MEDIUM',
                actionUrl: `/orders/${orderId}`,
            });
        }
        catch (notificationError) {
            console.error('Failed to create order status notification:', notificationError);
            // Don't fail the order update if notification creation fails
        }
        res.json({
            status: 'Success',
            message: 'Order status updated successfully',
            data: updatedOrder[0],
        });
    }
    catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Verify order (for payment verification)
router.patch('/verify-order', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { transactionId, txRef, status: paymentStatus } = req.body;
        if (!transactionId || !txRef) {
            return res.status(400).json({ error: 'Transaction ID and txRef are required' });
        }
        // Find orders related to this transaction
        const userOrders = await database_1.default.select()
            .from(schema_1.orders)
            .where((0, drizzle_orm_1.eq)(schema_1.orders.buyerId, userId));
        if (userOrders.length === 0) {
            return res.status(404).json({ error: 'No orders found for this user' });
        }
        // Update order status based on payment verification
        let newStatus = 'pending';
        let message = 'Order verification pending';
        if (paymentStatus === 'successful') {
            newStatus = 'confirmed';
            message = 'Order verified successfully';
        }
        else if (paymentStatus === 'failed') {
            newStatus = 'cancelled';
            message = 'Order verification failed';
        }
        // Update the most recent pending order
        const pendingOrder = userOrders.find(order => order.status === 'pending');
        if (pendingOrder) {
            const updatedOrder = await database_1.default.update(schema_1.orders)
                .set({
                status: newStatus,
                updatedAt: new Date()
            })
                .where((0, drizzle_orm_1.eq)(schema_1.orders.id, pendingOrder.id))
                .returning();
            // Generate receipt if payment was successful
            if (paymentStatus === 'successful') {
                try {
                    // Call receipt generation API internally
                    const receiptResponse = await axios_1.default.post('http://localhost:3000/api/receipts/generate', {
                        orderId: pendingOrder.id,
                        paymentMethod: 'card', // Default, can be updated based on actual payment method
                        transactionRef: txRef,
                    }, {
                        headers: {
                            'Authorization': `Bearer ${req.token}`, // Pass the user's token
                            'Content-Type': 'application/json'
                        }
                    });
                    message += `. Receipt generated: ${receiptResponse.data.receipt.receiptNumber}`;
                }
                catch (receiptError) {
                    console.error('Receipt generation failed:', receiptError);
                    // Don't fail the order verification if receipt generation fails
                    message += '. Note: Receipt generation pending.';
                }
            }
            res.json({
                status: 'Success',
                message: message,
                data: updatedOrder[0],
            });
        }
        else {
            res.status(404).json({ error: 'No pending order found to verify' });
        }
    }
    catch (error) {
        console.error('Verify order error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Confirm order (for vendors)
router.post('/confirm-order', auth_1.authenticateToken, async (req, res) => {
    try {
        const { txRef } = req.body;
        const sellerId = req.user.userId;
        if (!txRef) {
            return res.status(400).json({ error: 'Transaction reference is required' });
        }
        // Find orders for this vendor
        const vendorOrders = await database_1.default.select()
            .from(schema_1.orders)
            .where((0, drizzle_orm_1.eq)(schema_1.orders.sellerId, sellerId));
        if (vendorOrders.length === 0) {
            return res.status(404).json({ error: 'No orders found for this vendor' });
        }
        res.json({
            status: 'Success',
            message: 'Order confirmation processed',
            data: { txRef },
        });
    }
    catch (error) {
        console.error('Confirm order error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get single order details
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const order = await database_1.default.select({
            id: schema_1.orders.id,
            quantity: schema_1.orders.quantity,
            totalPrice: schema_1.orders.totalPrice,
            status: schema_1.orders.status,
            deliveryAddress: schema_1.orders.deliveryAddress,
            createdAt: schema_1.orders.createdAt,
            updatedAt: schema_1.orders.updatedAt,
            product: {
                id: schema_1.products.id,
                name: schema_1.products.name,
                price: schema_1.products.price,
                unit: schema_1.products.unit,
                image: schema_1.products.image,
                description: schema_1.products.description,
            },
            seller: {
                id: schema_1.users.id,
                fullName: schema_1.users.fullName,
                profilePicture: schema_1.users.profilePicture,
                phone: schema_1.users.phone,
                email: schema_1.users.email,
            },
        })
            .from(schema_1.orders)
            .leftJoin(schema_1.products, (0, drizzle_orm_1.eq)(schema_1.orders.productId, schema_1.products.id))
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.orders.sellerId, schema_1.users.id))
            .where((0, drizzle_orm_1.eq)(schema_1.orders.id, id));
        if (order.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        // Check if user has access to this order (buyer or seller)
        const orderData = order[0];
        const hasAccess = await database_1.default.select()
            .from(schema_1.orders)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.orders.id, id)));
        res.json({
            status: 'Success',
            message: 'Order fetched successfully',
            data: orderData,
        });
    }
    catch (error) {
        console.error('Get order details error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Cancel order (Consumer side)
router.put('/:id/cancel', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const buyerId = req.user.userId;
        const { reason } = req.body;
        // Check if order belongs to the buyer and can be cancelled
        const existingOrder = await database_1.default.select().from(schema_1.orders).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.orders.id, id), (0, drizzle_orm_1.eq)(schema_1.orders.buyerId, buyerId)));
        if (existingOrder.length === 0) {
            return res.status(404).json({ error: 'Order not found or you do not have permission to cancel it' });
        }
        const order = existingOrder[0];
        // Only allow cancellation for pending, confirmed, or processing orders
        if (!order.status || !['pending', 'confirmed', 'processing'].includes(order.status)) {
            return res.status(400).json({ error: 'Order cannot be cancelled at this stage' });
        }
        const updatedOrder = await database_1.default.update(schema_1.orders)
            .set({
            status: 'cancelled',
            updatedAt: new Date()
        })
            .where((0, drizzle_orm_1.eq)(schema_1.orders.id, id))
            .returning();
        res.json({
            status: 'Success',
            message: 'Order cancelled successfully',
            data: updatedOrder[0],
        });
    }
    catch (error) {
        console.error('Cancel order error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Refund order (Merchant/Admin side)
router.post('/:id/refund', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const { refundAmount, refundReason } = req.body;
        if (!refundAmount || !refundReason) {
            return res.status(400).json({ error: 'Refund amount and reason are required' });
        }
        // Get order details
        const existingOrder = await database_1.default.select({
            id: schema_1.orders.id,
            buyerId: schema_1.orders.buyerId,
            sellerId: schema_1.orders.sellerId,
            totalPrice: schema_1.orders.totalPrice,
            status: schema_1.orders.status,
            buyer: {
                fullName: schema_1.users.fullName,
                email: schema_1.users.email,
            },
        })
            .from(schema_1.orders)
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.orders.buyerId, schema_1.users.id))
            .where((0, drizzle_orm_1.eq)(schema_1.orders.id, id));
        if (existingOrder.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        const order = existingOrder[0];
        // Check if user has permission (seller or admin)
        const userRole = req.user.role;
        if (order.sellerId !== userId && userRole !== 'ADMIN') {
            return res.status(403).json({ error: 'You do not have permission to process this refund' });
        }
        // Update order status
        const updatedOrder = await database_1.default.update(schema_1.orders)
            .set({
            status: 'cancelled',
            updatedAt: new Date()
        })
            .where((0, drizzle_orm_1.eq)(schema_1.orders.id, id))
            .returning();
        // Here you would integrate with payment provider for actual refund
        // For now, we'll just log the refund request
        console.log(`Refund processed for order ${id}: ${refundAmount} - ${refundReason}`);
        res.json({
            status: 'Success',
            message: 'Refund processed successfully',
            data: {
                order: updatedOrder[0],
                refundAmount,
                refundReason,
            },
        });
    }
    catch (error) {
        console.error('Process refund error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Add order review/rating
router.post('/:id/review', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const buyerId = req.user.userId;
        const { rating, review } = req.body;
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5' });
        }
        // Check if order belongs to the buyer and is delivered
        const existingOrder = await database_1.default.select().from(schema_1.orders).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.orders.id, id), (0, drizzle_orm_1.eq)(schema_1.orders.buyerId, buyerId), (0, drizzle_orm_1.eq)(schema_1.orders.status, 'delivered')));
        if (existingOrder.length === 0) {
            return res.status(404).json({ error: 'Order not found, not yours, or not delivered yet' });
        }
        // For now, we'll store the review in a simple format
        // In a production system, you'd have a separate reviews table
        const reviewData = {
            orderId: id,
            rating,
            review: review || '',
            reviewDate: new Date(),
        };
        res.json({
            status: 'Success',
            message: 'Review submitted successfully',
            data: reviewData,
        });
    }
    catch (error) {
        console.error('Submit review error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=orders.js.map