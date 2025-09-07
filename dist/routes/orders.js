"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const database_1 = __importDefault(require("../config/database"));
const schema_1 = require("../schema");
const auth_1 = require("../utils/auth");
const router = (0, express_1.Router)();
// Create order from cart
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
        // Create orders for each product (grouped by seller)
        const createdOrders = [];
        for (const item of cart) {
            if (!item.product?.inStock) {
                return res.status(400).json({ error: `Product ${item.product?.name} is out of stock` });
            }
            const totalPrice = Number(item.product.price) * item.quantity;
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
        });
    }
    catch (error) {
        console.error('Checkout error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get user orders
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
            orders: userOrders,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: userOrders.length,
            },
        });
    }
    catch (error) {
        console.error('Get user orders error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get merchant orders
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
            orders: merchantOrders,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: merchantOrders.length,
            },
        });
    }
    catch (error) {
        console.error('Get merchant orders error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Update order status (Merchant only)
router.put('/:id/status', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const sellerId = req.user.userId;
        const { status } = req.body;
        const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        // Check if order belongs to the seller
        const existingOrder = await database_1.default.select().from(schema_1.orders).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.orders.id, id), (0, drizzle_orm_1.eq)(schema_1.orders.sellerId, sellerId)));
        if (existingOrder.length === 0) {
            return res.status(404).json({ error: 'Order not found or you do not have permission to update it' });
        }
        const updatedOrder = await database_1.default.update(schema_1.orders)
            .set({
            status: status,
            updatedAt: new Date()
        })
            .where((0, drizzle_orm_1.eq)(schema_1.orders.id, id))
            .returning();
        res.json({
            message: 'Order status updated successfully',
            order: updatedOrder[0],
        });
    }
    catch (error) {
        console.error('Update order status error:', error);
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
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.orders.id, id)));
        if (order.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        res.json(order[0]);
    }
    catch (error) {
        console.error('Get order details error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=orders.js.map