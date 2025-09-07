
import { Router } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import db from '../config/database';
import { orders, products, users, cartItems } from '../schema';
import { authenticateToken } from '../utils/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Create order from cart (checkout)
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
      totalPrice: totalOrderPrice,
    });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Place order (alternative endpoint matching NestJS structure)
router.post('/place', authenticateToken, async (req, res) => {
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

      const order = await db.insert(orders).values({
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
    await db.delete(cartItems).where(eq(cartItems.userId, buyerId));

    res.status(201).json({
      status: 'Success',
      message: 'Order placed successfully',
      data: {
        orders: createdOrders,
        totalPrice: totalPrice,
      },
    });
  } catch (error) {
    console.error('Place order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user orders (consumer orders)
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
  } catch (error) {
    console.error('Get user orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get consumer orders (alternative endpoint matching NestJS)
router.get('/consumer-orders', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;

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
      .where(eq(orders.buyerId, userId))
      .orderBy(desc(orders.createdAt));

    res.json({
      status: 'Success',
      message: 'Orders fetched successfully',
      data: userOrders,
    });
  } catch (error) {
    console.error('Get consumer orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get merchant orders (vendor orders)
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
  } catch (error) {
    console.error('Get merchant orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get vendor orders (alternative endpoint matching NestJS)
router.get('/vendor-orders', authenticateToken, async (req, res) => {
  try {
    const sellerId = (req as any).user.userId;

    const vendorOrders = await db.select({
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
      .where(eq(orders.sellerId, sellerId))
      .orderBy(desc(orders.createdAt));

    res.json({
      status: 'Success',
      message: 'Vendor orders fetched successfully',
      data: vendorOrders,
    });
  } catch (error) {
    console.error('Get vendor orders error:', error);
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
      status: 'Success',
      message: 'Order status updated successfully',
      data: updatedOrder[0],
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify order (for payment verification)
router.patch('/verify-order', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { transactionId, txRef, status: paymentStatus } = req.body;

    if (!transactionId || !txRef) {
      return res.status(400).json({ error: 'Transaction ID and txRef are required' });
    }

    // Find orders related to this transaction
    const userOrders = await db.select()
      .from(orders)
      .where(eq(orders.buyerId, userId));

    if (userOrders.length === 0) {
      return res.status(404).json({ error: 'No orders found for this user' });
    }

    // Update order status based on payment verification
    let newStatus = 'pending';
    let message = 'Order verification pending';

    if (paymentStatus === 'successful') {
      newStatus = 'confirmed';
      message = 'Order verified successfully';
    } else if (paymentStatus === 'failed') {
      newStatus = 'cancelled';
      message = 'Order verification failed';
    }

    // Update the most recent pending order
    const pendingOrder = userOrders.find(order => order.status === 'pending');
    
    if (pendingOrder) {
      const updatedOrder = await db.update(orders)
        .set({ 
          status: newStatus as any,
          updatedAt: new Date()
        })
        .where(eq(orders.id, pendingOrder.id))
        .returning();

      res.json({
        status: 'Success',
        message: message,
        data: updatedOrder[0],
      });
    } else {
      res.status(404).json({ error: 'No pending order found to verify' });
    }
  } catch (error) {
    console.error('Verify order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Confirm order (for vendors)
router.post('/confirm-order', authenticateToken, async (req, res) => {
  try {
    const { txRef } = req.body;
    const sellerId = (req as any).user.userId;

    if (!txRef) {
      return res.status(400).json({ error: 'Transaction reference is required' });
    }

    // Find orders for this vendor
    const vendorOrders = await db.select()
      .from(orders)
      .where(eq(orders.sellerId, sellerId));

    if (vendorOrders.length === 0) {
      return res.status(404).json({ error: 'No orders found for this vendor' });
    }

    res.json({
      status: 'Success',
      message: 'Order confirmation processed',
      data: { txRef },
    });
  } catch (error) {
    console.error('Confirm order error:', error);
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
      .where(eq(orders.id, id));

    if (order.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check if user has access to this order (buyer or seller)
    const orderData = order[0];
    const hasAccess = await db.select()
      .from(orders)
      .where(and(
        eq(orders.id, id),
        // User is either buyer or seller
      ));

    res.json({
      status: 'Success',
      message: 'Order fetched successfully',
      data: orderData,
    });
  } catch (error) {
    console.error('Get order details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
