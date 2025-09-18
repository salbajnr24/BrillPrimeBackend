import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import db from '../config/database';
import { cartItems, products, users } from '../schema';
import { authenticateToken } from '../utils/auth';

const router = Router();

// Get user cart
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    const cart = await db.select({
      id: cartItems.id,
      quantity: cartItems.quantity,
      createdAt: cartItems.createdAt,
      product: {
        id: products.id,
        name: products.name,
        price: products.price,
        unit: products.unit,
        image: products.image,
        inStock: products.inStock,
        minimumOrder: products.minimumOrder,
      },
      seller: {
        id: users.id,
        fullName: users.fullName,
        profilePicture: users.profilePicture,
      },
    })
      .from(cartItems)
      .leftJoin(products, eq(cartItems.productId, products.id))
      .leftJoin(users, eq(products.sellerId, users.id))
      .where(eq(cartItems.userId, userId));

    const totalAmount = cart.reduce((total, item) => {
      return total + (Number(item.product?.price || 0) * item.quantity);
    }, 0);

    res.json({
      cart,
      totalItems: cart.length,
      totalAmount: totalAmount.toFixed(2),
    });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add item to cart
router.post('/add', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { productId, quantity = 1 } = req.body;

    if (!productId) {
      return res.status(400).json({ error: 'Product ID is required' });
    }

    // Check if product exists and is active
    const product = await db.select().from(products).where(and(
      eq(products.id, productId),
      eq(products.isActive, true),
      eq(products.inStock, true)
    ));

    if (product.length === 0) {
      return res.status(404).json({ error: 'Product not found or out of stock' });
    }

    // Check if item already exists in cart
    const existingItem = await db.select().from(cartItems).where(and(
      eq(cartItems.userId, userId),
      eq(cartItems.productId, productId)
    ));

    if (existingItem.length > 0) {
      // Update quantity
      const updatedItem = await db.update(cartItems)
        .set({ quantity: existingItem[0].quantity + quantity })
        .where(eq(cartItems.id, existingItem[0].id))
        .returning();

      res.json({
        message: 'Cart item updated successfully',
        item: updatedItem[0],
      });
    } else {
      // Add new item
      const newItem = await db.insert(cartItems).values({
        userId,
        productId,
        quantity,
      }).returning();

      res.status(201).json({
        message: 'Item added to cart successfully',
        item: newItem[0],
      });
    }
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Alternative add endpoint for frontend compatibility
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { productId, quantity = 1 } = req.body;

    if (!productId) {
      return res.status(400).json({ error: 'Product ID is required' });
    }

    // Check if product exists and is active
    const product = await db.select().from(products).where(and(
      eq(products.id, productId),
      eq(products.isActive, true),
      eq(products.inStock, true)
    ));

    if (product.length === 0) {
      return res.status(404).json({ error: 'Product not found or out of stock' });
    }

    // Check if item already exists in cart
    const existingItem = await db.select().from(cartItems).where(and(
      eq(cartItems.userId, userId),
      eq(cartItems.productId, productId)
    ));

    if (existingItem.length > 0) {
      // Update quantity
      const updatedItem = await db.update(cartItems)
        .set({ quantity: existingItem[0].quantity + quantity })
        .where(eq(cartItems.id, existingItem[0].id))
        .returning();

      res.json({
        status: 'Success',
        message: 'Cart item updated successfully',
        data: updatedItem[0],
      });
    } else {
      // Add new item
      const newItem = await db.insert(cartItems).values({
        userId,
        productId,
        quantity,
      }).returning();

      res.status(201).json({
        status: 'Success',
        message: 'Item added to cart successfully',
        data: newItem[0],
      });
    }
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update cart item quantity
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({ error: 'Valid quantity is required' });
    }

    const updatedItem = await db.update(cartItems)
      .set({ quantity })
      .where(and(
        eq(cartItems.id, Number(id)),
        eq(cartItems.userId, userId)
      ))
      .returning();

    if (updatedItem.length === 0) {
      return res.status(404).json({ error: 'Cart item not found' });
    }

    res.json({
      message: 'Cart item updated successfully',
      item: updatedItem[0],
    });
  } catch (error) {
    console.error('Update cart item error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove item from cart
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    const deletedItem = await db.delete(cartItems)
      .where(and(
        eq(cartItems.id, Number(id)),
        eq(cartItems.userId, userId)
      ))
      .returning();

    if (deletedItem.length === 0) {
      return res.status(404).json({ error: 'Cart item not found' });
    }

    res.json({ message: 'Item removed from cart successfully' });
  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Clear cart
router.delete('/', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    await db.delete(cartItems).where(eq(cartItems.userId, userId));

    res.json({ message: 'Cart cleared successfully' });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;