
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

export default router;
