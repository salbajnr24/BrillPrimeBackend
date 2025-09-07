
import { Router } from 'express';
import axios from 'axios';
import { authenticateToken } from '../utils/auth';
import db from '../config/database';
import { orders, users } from '../schema';
import { eq, and } from 'drizzle-orm';

const router = Router();

// Environment variables for Flutterwave
const FLUTTERWAVE_BASE_URL = process.env.FLW_BASE_URL || 'https://api.flutterwave.com/v3';
const FLUTTERWAVE_SECRET_KEY = process.env.FLW_SECRET_KEY;

// Initialize payment
router.post('/initialize', authenticateToken, async (req, res) => {
  try {
    const { amount, currency = 'NGN', customerEmail } = req.body;
    const userId = (req as any).user.userId;

    if (!amount || !customerEmail) {
      return res.status(400).json({ error: 'Amount and customer email are required' });
    }

    const txRef = `payment-${userId}-${Date.now()}`;

    const response = await axios.post(
      `${FLUTTERWAVE_BASE_URL}/payments`,
      {
        tx_ref: txRef,
        amount,
        currency,
        redirect_url: `${process.env.BASE_URL || 'http://localhost:5000'}/api/payment/callback`,
        customer: {
          email: customerEmail,
        },
        customizations: {
          title: 'Brillprime',
          description: 'Order Payment',
        },
      },
      {
        headers: {
          Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({
      status: 'Success',
      message: 'Payment initialized successfully',
      data: {
        paymentLink: response.data.data.link,
        txRef: txRef,
      },
    });
  } catch (error) {
    console.error('Payment initialization error:', error);
    res.status(500).json({ error: 'Payment initialization failed' });
  }
});

// Payment callback endpoint
router.get('/callback', async (req, res) => {
  try {
    const { transaction_id, tx_ref, status } = req.query;

    if (!transaction_id) {
      return res.status(400).json({ error: 'Transaction ID is required' });
    }

    const paymentData = await verifyPayment(transaction_id as string);
    
    if (paymentData === 'successful') {
      // Redirect to success page
      return res.redirect(`${process.env.APP_URL || 'http://localhost:3000'}/payment/success?tx_ref=${tx_ref}`);
    } else {
      // Redirect to failure page
      return res.redirect(`${process.env.APP_URL || 'http://localhost:3000'}/payment/failure?tx_ref=${tx_ref}`);
    }
  } catch (error) {
    console.error('Payment callback error:', error);
    return res.redirect(`${process.env.APP_URL || 'http://localhost:3000'}/payment/failure`);
  }
});

// Webhook endpoint for Flutterwave notifications
router.post('/webhook', async (req, res) => {
  try {
    const { data } = req.body;
    const { tx_ref, status, transaction_id } = data;

    console.log('Webhook received:', { tx_ref, status, transaction_id });

    // Verify webhook signature if needed
    // const signature = req.headers['verif-hash'];
    
    if (status === 'successful') {
      // Update order status or handle successful payment
      console.log(`Payment successful for tx_ref: ${tx_ref}`);
    }

    res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Verify payment
router.post('/verify', authenticateToken, async (req, res) => {
  try {
    const { transactionId, txRef } = req.body;
    const userId = (req as any).user.userId;

    if (!transactionId || !txRef) {
      return res.status(400).json({ error: 'Transaction ID and txRef are required' });
    }

    const paymentStatus = await verifyPayment(transactionId);
    
    // Find and update related orders
    const userOrders = await db.select()
      .from(orders)
      .where(eq(orders.buyerId, userId));

    let message = 'Payment verification pending';
    let newStatus = 'pending';

    if (paymentStatus === 'successful') {
      newStatus = 'confirmed';
      message = 'Payment verified successfully';
    } else if (paymentStatus === 'failed') {
      newStatus = 'cancelled';
      message = 'Payment verification failed';
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
        data: {
          order: updatedOrder[0],
          paymentStatus: paymentStatus,
        },
      });
    } else {
      res.status(404).json({ error: 'No pending order found to verify' });
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

// Get list of banks
router.get('/banks', authenticateToken, async (req, res) => {
  try {
    const { search } = req.query;

    const response = await axios.get('https://api.flutterwave.com/v3/banks/NG', {
      headers: {
        Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
      },
    });

    if (response.data.status !== 'success') {
      return res.status(400).json({ error: 'Failed to fetch bank list' });
    }

    let banks = response.data.data;

    // Apply search filter if provided
    if (search) {
      const lowerSearch = (search as string).toLowerCase();
      banks = banks.filter(
        (bank: any) => 
          bank.name.toLowerCase().includes(lowerSearch) || 
          bank.code.includes(search as string)
      );
    }

    res.json({
      status: 'Success',
      message: 'Banks fetched successfully',
      data: banks,
    });
  } catch (error) {
    console.error('Get banks error:', error);
    res.status(500).json({ error: 'Failed to fetch banks' });
  }
});

// Verify bank account
router.post('/verify-account', authenticateToken, async (req, res) => {
  try {
    const { accountNumber, bankCode } = req.body;

    if (!accountNumber || !bankCode) {
      return res.status(400).json({ error: 'Account number and bank code are required' });
    }

    const response = await axios.post(
      'https://api.flutterwave.com/v3/accounts/resolve',
      {
        account_number: accountNumber,
        account_bank: bankCode,
      },
      {
        headers: {
          Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.status !== 'success') {
      return res.status(400).json({ error: 'Failed to verify account' });
    }

    res.json({
      status: 'Success',
      message: 'Account verified successfully',
      data: response.data.data,
    });
  } catch (error) {
    console.error('Account verification error:', error);
    res.status(500).json({ error: 'Account verification failed' });
  }
});

// Settle vendor payment (transfer funds)
router.post('/settle/:orderId', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;

    // Get order details
    const orderData = await db.select({
      id: orders.id,
      sellerId: orders.sellerId,
      totalPrice: orders.totalPrice,
      status: orders.status,
      seller: {
        id: users.id,
        fullName: users.fullName,
        // Add account details fields when available in your schema
      }
    })
      .from(orders)
      .leftJoin(users, eq(orders.sellerId, users.id))
      .where(eq(orders.id, orderId));

    if (orderData.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderData[0];

    if (order.status !== 'confirmed') {
      return res.status(400).json({ error: 'Order has not been paid' });
    }

    // Note: You'll need to add account details to your users schema
    // For now, this is a placeholder for the settlement logic
    
    res.json({
      status: 'Success',
      message: 'Settlement initiated (implementation pending account details)',
      data: { orderId: order.id },
    });
  } catch (error) {
    console.error('Settlement error:', error);
    res.status(500).json({ error: 'Settlement failed' });
  }
});

// Helper function to verify payment with Flutterwave
async function verifyPayment(transactionId: string): Promise<string> {
  try {
    const response = await axios.get(
      `${FLUTTERWAVE_BASE_URL}/transactions/${transactionId}/verify`,
      {
        headers: {
          Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.data.status;
  } catch (error) {
    console.error('Payment verification error:', error);
    throw new Error('Failed to verify payment');
  }
}

// Process refund
router.post('/refund/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params; // This could be order ID or transaction ID
    const { amount, reason, refundType = 'full' } = req.body;
    const userId = (req as any).user.userId;

    if (!reason) {
      return res.status(400).json({ error: 'Refund reason is required' });
    }

    // Get order details
    const orderData = await db.select().from(orders).where(eq(orders.id, id));
    
    if (orderData.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderData[0];
    const userRole = (req as any).user.role;

    // Check permissions (merchant can refund their orders, admin can refund any)
    if (order.sellerId !== userId && userRole !== 'ADMIN') {
      return res.status(403).json({ error: 'You do not have permission to process this refund' });
    }

    const refundAmount = amount || parseFloat(order.totalPrice);

    // In production, integrate with Flutterwave refund API
    try {
      // Example Flutterwave refund call
      /*
      const refundResponse = await axios.post(
        `${FLUTTERWAVE_BASE_URL}/transactions/${transactionId}/refund`,
        {
          amount: refundAmount,
          comment: reason,
        },
        {
          headers: {
            Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );
      */

      // Update order status
      await db.update(orders)
        .set({ 
          status: 'cancelled',
          updatedAt: new Date()
        })
        .where(eq(orders.id, id));

      const refundData = {
        orderId: id,
        refundAmount,
        refundType,
        reason,
        status: 'PROCESSING',
        referenceId: `REF-${Date.now()}-${id}`,
        processedAt: new Date(),
      };

      res.json({
        status: 'Success',
        message: 'Refund processed successfully',
        data: refundData,
      });
    } catch (refundError) {
      console.error('Refund processing error:', refundError);
      res.status(500).json({ error: 'Failed to process refund' });
    }
  } catch (error) {
    console.error('Process refund error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create payment dispute
router.post('/dispute/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params; // Order or transaction ID
    const userId = (req as any).user.userId;
    const { disputeReason, description, evidence } = req.body;

    if (!disputeReason || !description) {
      return res.status(400).json({ 
        error: 'Dispute reason and description are required' 
      });
    }

    // Get order details
    const orderData = await db.select({
      id: orders.id,
      buyerId: orders.buyerId,
      sellerId: orders.sellerId,
      totalPrice: orders.totalPrice,
      status: orders.status,
    }).from(orders).where(eq(orders.id, id));

    if (orderData.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderData[0];

    // Check if user is involved in the order
    if (order.buyerId !== userId && order.sellerId !== userId) {
      return res.status(403).json({ error: 'You are not authorized to dispute this payment' });
    }

    // Create dispute record (in production, store in disputes table)
    const disputeData = {
      disputeId: `DISPUTE-${Date.now()}-${id}`,
      orderId: id,
      initiatedBy: userId,
      disputeReason,
      description,
      evidence: evidence || [],
      status: 'PENDING',
      createdAt: new Date(),
      amount: order.totalPrice,
    };

    res.json({
      status: 'Success',
      message: 'Payment dispute created successfully',
      data: disputeData,
    });
  } catch (error) {
    console.error('Create dispute error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Request payout (Merchant/Driver)
router.post('/payout', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const userRole = (req as any).user.role;
    const { amount, bankAccount, accountNumber, bankCode, notes } = req.body;

    if (!amount || !bankAccount || !accountNumber || !bankCode) {
      return res.status(400).json({ 
        error: 'Amount and bank details are required' 
      });
    }

    // Check user role
    if (!['MERCHANT', 'DRIVER'].includes(userRole)) {
      return res.status(403).json({ error: 'Only merchants and drivers can request payouts' });
    }

    let availableBalance = 0;

    if (userRole === 'MERCHANT') {
      // Calculate merchant available balance from completed orders
      const merchantEarnings = await db.select({
        totalEarnings: sql<string>`sum(${orders.totalPrice})`,
      })
        .from(orders)
        .where(and(
          eq(orders.sellerId, userId),
          eq(orders.status, 'delivered')
        ));

      availableBalance = parseFloat(merchantEarnings[0]?.totalEarnings || '0');
    } else if (userRole === 'DRIVER') {
      // Calculate driver available balance from completed deliveries
      const driverEarnings = await db.select({
        totalEarnings: sql<string>`sum(${deliveryRequests.deliveryFee})`,
      })
        .from(deliveryRequests)
        .where(and(
          eq(deliveryRequests.driverId, userId),
          eq(deliveryRequests.status, 'DELIVERED')
        ));

      availableBalance = parseFloat(driverEarnings[0]?.totalEarnings || '0');
    }

    if (amount > availableBalance) {
      return res.status(400).json({ 
        error: `Insufficient balance. Available: ${availableBalance}` 
      });
    }

    // Create payout request
    const payoutRequest = {
      payoutId: `PAYOUT-${Date.now()}-${userId}`,
      userId,
      userRole,
      amount,
      bankAccount,
      accountNumber,
      bankCode,
      notes: notes || '',
      status: 'PENDING',
      requestedAt: new Date(),
      availableBalance,
    };

    res.json({
      status: 'Success',
      message: 'Payout request submitted successfully',
      data: payoutRequest,
    });
  } catch (error) {
    console.error('Request payout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get payout history
router.get('/payout/history', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const userRole = (req as any).user.role;
    const { page = 1, limit = 10, status } = req.query;

    if (!['MERCHANT', 'DRIVER'].includes(userRole)) {
      return res.status(403).json({ error: 'Only merchants and drivers can view payout history' });
    }

    // In production, this would fetch from a payouts table
    // For now, return mock data
    const mockPayouts = [
      {
        payoutId: `PAYOUT-${Date.now()}-${userId}`,
        amount: '5000.00',
        status: 'COMPLETED',
        requestedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        processedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
        bankAccount: '**** **** **** 1234',
      },
      {
        payoutId: `PAYOUT-${Date.now() - 1000}-${userId}`,
        amount: '3000.00',
        status: 'PENDING',
        requestedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        bankAccount: '**** **** **** 1234',
      },
    ];

    const filteredPayouts = status 
      ? mockPayouts.filter(p => p.status === status)
      : mockPayouts;

    res.json({
      status: 'Success',
      message: 'Payout history fetched successfully',
      data: {
        payouts: filteredPayouts,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: filteredPayouts.length,
        },
      },
    });
  } catch (error) {
    console.error('Get payout history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
