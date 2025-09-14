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
// Get user cart
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const cart = await database_1.default.select({
            id: schema_1.cartItems.id,
            quantity: schema_1.cartItems.quantity,
            createdAt: schema_1.cartItems.createdAt,
            product: {
                id: schema_1.products.id,
                name: schema_1.products.name,
                price: schema_1.products.price,
                unit: schema_1.products.unit,
                image: schema_1.products.image,
                inStock: schema_1.products.inStock,
                minimumOrder: schema_1.products.minimumOrder,
            },
            seller: {
                id: schema_1.users.id,
                fullName: schema_1.users.fullName,
                profilePicture: schema_1.users.profilePicture,
            },
        })
            .from(schema_1.cartItems)
            .leftJoin(schema_1.products, (0, drizzle_orm_1.eq)(schema_1.cartItems.productId, schema_1.products.id))
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.products.sellerId, schema_1.users.id))
            .where((0, drizzle_orm_1.eq)(schema_1.cartItems.userId, userId));
        const totalAmount = cart.reduce((total, item) => {
            return total + (Number(item.product?.price || 0) * item.quantity);
        }, 0);
        res.json({
            cart,
            totalItems: cart.length,
            totalAmount: totalAmount.toFixed(2),
        });
    }
    catch (error) {
        console.error('Get cart error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Add item to cart
router.post('/add', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { productId, quantity = 1 } = req.body;
        if (!productId) {
            return res.status(400).json({ error: 'Product ID is required' });
        }
        // Check if product exists and is active
        const product = await database_1.default.select().from(schema_1.products).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.products.id, productId), (0, drizzle_orm_1.eq)(schema_1.products.isActive, true), (0, drizzle_orm_1.eq)(schema_1.products.inStock, true)));
        if (product.length === 0) {
            return res.status(404).json({ error: 'Product not found or out of stock' });
        }
        // Check if item already exists in cart
        const existingItem = await database_1.default.select().from(schema_1.cartItems).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.cartItems.userId, userId), (0, drizzle_orm_1.eq)(schema_1.cartItems.productId, productId)));
        if (existingItem.length > 0) {
            // Update quantity
            const updatedItem = await database_1.default.update(schema_1.cartItems)
                .set({ quantity: existingItem[0].quantity + quantity })
                .where((0, drizzle_orm_1.eq)(schema_1.cartItems.id, existingItem[0].id))
                .returning();
            res.json({
                message: 'Cart item updated successfully',
                item: updatedItem[0],
            });
        }
        else {
            // Add new item
            const newItem = await database_1.default.insert(schema_1.cartItems).values({
                userId,
                productId,
                quantity,
            }).returning();
            res.status(201).json({
                message: 'Item added to cart successfully',
                item: newItem[0],
            });
        }
    }
    catch (error) {
        console.error('Add to cart error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Update cart item quantity
router.put('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const { quantity } = req.body;
        if (!quantity || quantity < 1) {
            return res.status(400).json({ error: 'Valid quantity is required' });
        }
        const updatedItem = await database_1.default.update(schema_1.cartItems)
            .set({ quantity })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.cartItems.id, Number(id)), (0, drizzle_orm_1.eq)(schema_1.cartItems.userId, userId)))
            .returning();
        if (updatedItem.length === 0) {
            return res.status(404).json({ error: 'Cart item not found' });
        }
        res.json({
            message: 'Cart item updated successfully',
            item: updatedItem[0],
        });
    }
    catch (error) {
        console.error('Update cart item error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Remove item from cart
router.delete('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const deletedItem = await database_1.default.delete(schema_1.cartItems)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.cartItems.id, Number(id)), (0, drizzle_orm_1.eq)(schema_1.cartItems.userId, userId)))
            .returning();
        if (deletedItem.length === 0) {
            return res.status(404).json({ error: 'Cart item not found' });
        }
        res.json({ message: 'Item removed from cart successfully' });
    }
    catch (error) {
        console.error('Remove from cart error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Clear cart
router.delete('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        await database_1.default.delete(schema_1.cartItems).where((0, drizzle_orm_1.eq)(schema_1.cartItems.userId, userId));
        res.json({ message: 'Cart cleared successfully' });
    }
    catch (error) {
        console.error('Clear cart error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
