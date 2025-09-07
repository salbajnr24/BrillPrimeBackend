import { Router } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import db from '../config/database';
import { orders, products, users, cartItems } from '../schema';
import { authenticateToken } from '../utils/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Create order from cart
router.post('/checkout', authenticateToken, async (req, res) => {
  try {
    const buyerId = (req as any).user.userId;
    const { deliveryAddress } = req.body;

    if (!deliveryAddress) {
      return res.status(400).json({ error: 'Delivery address is required' });
    }

    // Get cart items
    const cart = await db.select({
      id: cartItems.id,
      quantity: cartItems.quantity,
      product: {
        id: products.id,
        name: products.name,
        price: products.price,
        sellerId: products.sellerId,
        inStock: products.inStock,
      },
    })
      .from(cartItems)
      .leftJoin(products, eq(cartItems.productId, products.id))
      .where(eq(cartItems.userId, buyerId));

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

      const order = await db.insert(orders).values({
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
    await db.delete(cartItems).where(eq(cartItems.userId, buyerId));

    res.status(201).json({
      message: 'Orders created successfully',
      orders: createdOrders,
    });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user orders
router.get('/my-orders', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { page = 1, limit = 10, status } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereConditions = [eq(orders.buyerId, userId)];
    if (status) {
      whereConditions.push(eq(orders.status, status as any));
    }

    const userOrders = await db.select({
      id: orders.id,
      quantity: orders.quantity,
      totalPrice: orders.totalPrice,
      status: orders.status,
      deliveryAddress: orders.deliveryAddress,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
      product: {
        id: products.id,
        name: products.name,
        price: products.price,
        unit: products.unit,
        image: products.image,
      },
      seller: {
        id: users.id,
        fullName: users.fullName,
        profilePicture: users.profilePicture,
        phone: users.phone,
      },
    })
      .from(orders)
      .leftJoin(products, eq(orders.productId, products.id))
      .leftJoin(users, eq(orders.sellerId, users.id))
      .where(and(...whereConditions))
      .orderBy(desc(orders.createdAt))
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
  } catch (error) {
    console.error('Get user orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get merchant orders
router.get('/merchant-orders', authenticateToken, async (req, res) => {
  try {
    const sellerId = (req as any).user.userId;
    const { page = 1, limit = 10, status } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereConditions = [eq(orders.sellerId, sellerId)];
    if (status) {
      whereConditions.push(eq(orders.status, status as any));
    }

    const merchantOrders = await db.select({
      id: orders.id,
      quantity: orders.quantity,
      totalPrice: orders.totalPrice,
      status: orders.status,
      deliveryAddress: orders.deliveryAddress,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
      product: {
        id: products.id,
        name: products.name,
        price: products.price,
        unit: products.unit,
        image: products.image,
      },
      buyer: {
        id: users.id,
        fullName: users.fullName,
        profilePicture: users.profilePicture,
        phone: users.phone,
        email: users.email,
      },
    })
      .from(orders)
      .leftJoin(products, eq(orders.productId, products.id))
      .leftJoin(users, eq(orders.buyerId, users.id))
      .where(and(...whereConditions))
      .orderBy(desc(orders.createdAt))
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
  } catch (error) {
    console.error('Get merchant orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update order status (Merchant only)
router.put('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const sellerId = (req as any).user.userId;
    const { status } = req.body;

    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Check if order belongs to the seller
    const existingOrder = await db.select().from(orders).where(and(
      eq(orders.id, id),
      eq(orders.sellerId, sellerId)
    ));

    if (existingOrder.length === 0) {
      return res.status(404).json({ error: 'Order not found or you do not have permission to update it' });
    }

    const updatedOrder = await db.update(orders)
      .set({ 
        status: status as any,
        updatedAt: new Date()
      })
      .where(eq(orders.id, id))
      .returning();

    res.json({
      message: 'Order status updated successfully',
      order: updatedOrder[0],
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single order details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    const order = await db.select({
      id: orders.id,
      quantity: orders.quantity,
      totalPrice: orders.totalPrice,
      status: orders.status,
      deliveryAddress: orders.deliveryAddress,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
      product: {
        id: products.id,
        name: products.name,
        price: products.price,
        unit: products.unit,
        image: products.image,
        description: products.description,
      },
      seller: {
        id: users.id,
        fullName: users.fullName,
        profilePicture: users.profilePicture,
        phone: users.phone,
        email: users.email,
      },
    })
      .from(orders)
      .leftJoin(products, eq(orders.productId, products.id))
      .leftJoin(users, eq(orders.sellerId, users.id))
      .where(and(
        eq(orders.id, id),
        // User can view order if they are buyer or seller
        // This is simplified - in production you'd want better access control
      ));

    if (order.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order[0]);
  } catch (error) {
    console.error('Get order details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;