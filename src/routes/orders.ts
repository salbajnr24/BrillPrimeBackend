import { Router } from 'express';
import { eq, and, desc, sql } from 'drizzle-orm';
import axios from 'axios';
import db from '../config/database';
import { orders, products, cartItems, users } from '../schema';
import { authenticateToken, authorizeRoles } from '../utils/auth';
import { Message } from '../utils/messages';
import { createNotification } from './notifications';

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
    const { id: orderId } = req.params;
    const sellerId = (req as any).user.userId;
    const { status } = req.body;

    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Check if order belongs to the seller
    const existingOrder = await db.select().from(orders).where(and(
      eq(orders.id, orderId),
      eq(orders.sellerId, sellerId)
    ));

    if (existingOrder.length === 0) {
      return res.status(404).json({ error: 'Order not found or you do not have permission to update it' });
    }

    const updatedOrder = await db.update(orders)
      .set({ status: status as any })
      .where(and(
        eq(orders.id, orderId),
        eq(orders.sellerId, sellerId)
      ))
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
      await createNotification({
        userId: updatedOrder[0].buyerId,
        userRole: 'CONSUMER',
        title: `Order ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        message: statusMessages[status as keyof typeof statusMessages] || `Your order status has been updated to ${status}`,
        type: 'ORDER_STATUS',
        relatedId: orderId,
        priority: status === 'delivered' || status === 'cancelled' ? 'HIGH' : 'MEDIUM',
        actionUrl: `/orders/${orderId}`,
      });
    } catch (notificationError) {
      console.error('Failed to create order status notification:', notificationError);
      // Don't fail the order update if notification creation fails
    }

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

      // Generate receipt if payment was successful
      if (paymentStatus === 'successful') {
        try {
          // Call receipt generation API internally
          const receiptResponse = await axios.post('http://localhost:3000/api/receipts/generate', {
            orderId: pendingOrder.id,
            paymentMethod: 'card', // Default, can be updated based on actual payment method
            transactionRef: txRef,
          }, {
            headers: {
              'Authorization': `Bearer ${(req as any).token}`, // Pass the user's token
              'Content-Type': 'application/json'
            }
          });

          message += `. Receipt generated: ${receiptResponse.data.receipt.receiptNumber}`;
        } catch (receiptError) {
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

// Cancel order (Consumer side)
router.put('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const buyerId = (req as any).user.userId;
    const { reason } = req.body;

    // Check if order belongs to the buyer and can be cancelled
    const existingOrder = await db.select().from(orders).where(and(
      eq(orders.id, id),
      eq(orders.buyerId, buyerId)
    ));

    if (existingOrder.length === 0) {
      return res.status(404).json({ error: 'Order not found or you do not have permission to cancel it' });
    }

    const order = existingOrder[0];

    // Only allow cancellation for pending, confirmed, or processing orders
    if (!order.status || !['pending', 'confirmed', 'processing'].includes(order.status)) {
      return res.status(400).json({ error: 'Order cannot be cancelled at this stage' });
    }

    const updatedOrder = await db.update(orders)
      .set({ 
        status: 'cancelled',
        updatedAt: new Date()
      })
      .where(eq(orders.id, id))
      .returning();

    res.json({
      status: 'Success',
      message: 'Order cancelled successfully',
      data: updatedOrder[0],
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refund order (Merchant/Admin side)
router.post('/:id/refund', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    const { refundAmount, refundReason } = req.body;

    if (!refundAmount || !refundReason) {
      return res.status(400).json({ error: 'Refund amount and reason are required' });
    }

    // Get order details
    const existingOrder = await db.select({
      id: orders.id,
      buyerId: orders.buyerId,
      sellerId: orders.sellerId,
      totalPrice: orders.totalPrice,
      status: orders.status,
      buyer: {
        fullName: users.fullName,
        email: users.email,
      },
    })
      .from(orders)
      .leftJoin(users, eq(orders.buyerId, users.id))
      .where(eq(orders.id, id));

    if (existingOrder.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = existingOrder[0];

    // Check if user has permission (seller or admin)
    const userRole = (req as any).user.role;
    if (order.sellerId !== userId && userRole !== 'ADMIN') {
      return res.status(403).json({ error: 'You do not have permission to process this refund' });
    }

    // Update order status
    const updatedOrder = await db.update(orders)
      .set({ 
        status: 'cancelled',
        updatedAt: new Date()
      })
      .where(eq(orders.id, id))
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
  } catch (error) {
    console.error('Process refund error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add order review/rating
router.post('/:id/review', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const buyerId = (req as any).user.userId;
    const { rating, review } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Check if order belongs to the buyer and is delivered
    const existingOrder = await db.select().from(orders).where(and(
      eq(orders.id, id),
      eq(orders.buyerId, buyerId),
      eq(orders.status, 'delivered')
    ));

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
  } catch (error) {
    console.error('Submit review error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update order status (Merchant only)
router.put('/:id/status', authenticateToken, authorizeRoles('MERCHANT'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const sellerId = (req as any).user.userId;

    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be one of: ' + validStatuses.join(', ') });
    }

    // Check if order exists and belongs to the merchant
    const existingOrder = await db.select().from(orders).where(and(
      eq(orders.id, id),
      eq(orders.sellerId, sellerId)
    ));

    if (existingOrder.length === 0) {
      return res.status(404).json({ error: 'Order not found or unauthorized' });
    }

    const updatedOrder = await db.update(orders)
      .set({ 
        status: status as any,
        updatedAt: new Date()
      })
      .where(eq(orders.id, id))
      .returning();

    // Notify customer about status update
    try {
      await createNotification({
        userId: existingOrder[0].buyerId,
        userRole: 'CONSUMER',
        title: 'Order Status Updated',
        message: `Your order #${id} status has been updated to ${status}`,
        type: 'ORDER_UPDATE',
        relatedId: id.toString(),
        priority: 'MEDIUM',
      });
    } catch (notificationError) {
      console.error('Failed to send order status notification:', notificationError);
    }

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

// Cancel order (Consumer only)
router.put('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const buyerId = (req as any).user.userId;

    // Check if order exists and belongs to the user
    const existingOrder = await db.select().from(orders).where(and(
      eq(orders.id, id),
      eq(orders.buyerId, buyerId)
    ));

    if (existingOrder.length === 0) {
      return res.status(404).json({ error: 'Order not found or unauthorized' });
    }

    // Only allow cancellation if order is still pending or confirmed
    if (!['pending', 'confirmed'].includes(existingOrder[0].status)) {
      return res.status(400).json({ error: 'Order cannot be cancelled at this stage' });
    }

    const cancelledOrder = await db.update(orders)
      .set({ 
        status: 'cancelled' as any,
        updatedAt: new Date()
      })
      .where(eq(orders.id, id))
      .returning();

    // Notify merchant about cancellation
    try {
      await createNotification({
        userId: existingOrder[0].sellerId,
        userRole: 'MERCHANT',
        title: 'Order Cancelled',
        message: `Order #${id} has been cancelled by the customer`,
        type: 'ORDER_CANCELLED',
        relatedId: id.toString(),
        priority: 'HIGH',
      });
    } catch (notificationError) {
      console.error('Failed to send order cancellation notification:', notificationError);
    }

    res.json({
      status: 'Success',
      message: 'Order cancelled successfully',
      data: cancelledOrder[0],
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Process order refund (Merchant/Admin only)
router.post('/:id/refund', authenticateToken, authorizeRoles('MERCHANT', 'ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, reason } = req.body;
    const userId = (req as any).user.userId;
    const userRole = (req as any).user.role;

    if (!amount || !reason) {
      return res.status(400).json({ error: 'Amount and reason are required' });
    }

    // Check if order exists
    const existingOrder = await db.select().from(orders).where(eq(orders.id, id));

    if (existingOrder.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = existingOrder[0];

    // Check authorization (merchant must own the order or be admin)
    if (userRole !== 'ADMIN' && order.sellerId !== userId) {
      return res.status(403).json({ error: 'Not authorized to refund this order' });
    }

    // Create refund transaction
    const refund = await db.insert(transactions).values({
      userId: order.buyerId,
      type: 'REFUND',
      amount: amount.toString(),
      status: 'COMPLETED',
      description: `Refund for order #${id}: ${reason}`,
      relatedOrderId: parseInt(id),
      processedBy: userId,
      createdAt: new Date()
    }).returning();

    // Update order status to refunded
    await db.update(orders)
      .set({ 
        status: 'refunded' as any,
        updatedAt: new Date()
      })
      .where(eq(orders.id, id));

    // Notify customer about refund
    try {
      await createNotification({
        userId: order.buyerId,
        userRole: 'CONSUMER',
        title: 'Refund Processed',
        message: `Your refund of ₦${amount} for order #${id} has been processed`,
        type: 'REFUND_PROCESSED',
        relatedId: id.toString(),
        priority: 'HIGH',
      });
    } catch (notificationError) {
      console.error('Failed to send refund notification:', notificationError);
    }

    res.json({
      status: 'Success',
      message: 'Refund processed successfully',
      data: refund[0],
    });
  } catch (error) {
    console.error('Process refund error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add order review
router.post('/:id/review', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    const userId = (req as any).user.userId;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Check if order exists and belongs to user and is delivered
    const existingOrder = await db.select().from(orders).where(and(
      eq(orders.id, id),
      eq(orders.buyerId, userId),
      eq(orders.status, 'delivered')
    ));

    if (existingOrder.length === 0) {
      return res.status(404).json({ error: 'Order not found, unauthorized, or not delivered' });
    }

    const order = existingOrder[0];

    // Check if review already exists
    const existingReview = await db.select().from(reviews).where(and(
      eq(reviews.userId, userId),
      eq(reviews.orderId, parseInt(id))
    ));

    if (existingReview.length > 0) {
      return res.status(400).json({ error: 'Review already exists for this order' });
    }

    // Create review
    const review = await db.insert(reviews).values({
      userId,
      targetType: 'PRODUCT',
      targetId: order.productId,
      orderId: parseInt(id),
      rating,
      comment,
      createdAt: new Date()
    }).returning();

    res.status(201).json({
      status: 'Success',
      message: 'Review added successfully',
      data: review[0],
    });
  } catch (error) {
    console.error('Add order review error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;