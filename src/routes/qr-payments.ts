
import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import db from '../config/database';
import { users, transactions, qrCodes } from '../schema';
import { authenticateToken } from '../utils/auth';
import QRCode from 'qrcode';
import crypto from 'crypto';

const router = Router();

// Generate QR code for payment
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const { amount, description, expiresIn = 3600 } = req.body; // expires in 1 hour by default
    const userId = (req as any).user.id;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    // Generate unique QR code ID
    const qrId = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // Create QR code record
    const qrCodeRecord = await db.insert(qrCodes).values({
      id: qrId,
      userId,
      amount: amount.toString(),
      description: description || 'Payment request',
      status: 'ACTIVE',
      expiresAt,
      createdAt: new Date()
    }).returning();

    // Generate QR code data
    const qrData = {
      type: 'PAYMENT_REQUEST',
      qrId,
      amount,
      merchantId: userId,
      description
    };

    // Generate QR code image
    const qrCodeImage = await QRCode.toDataURL(JSON.stringify(qrData));

    res.json({
      success: true,
      data: {
        qrId,
        qrCodeImage,
        amount,
        description,
        expiresAt,
        paymentUrl: `${process.env.FRONTEND_URL}/pay/qr/${qrId}`
      }
    });
  } catch (error) {
    console.error('Generate QR code error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate QR code' });
  }
});

// Process QR code payment
router.post('/pay/:qrId', authenticateToken, async (req, res) => {
  try {
    const { qrId } = req.params;
    const { paymentMethod = 'wallet' } = req.body;
    const payerId = (req as any).user.id;

    // Get QR code details
    const qrCode = await db.select().from(qrCodes).where(eq(qrCodes.id, qrId)).limit(1);

    if (qrCode.length === 0) {
      return res.status(404).json({ success: false, message: 'QR code not found' });
    }

    const qrRecord = qrCode[0];

    // Check if QR code is still active
    if (qrRecord.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'QR code is no longer active' });
    }

    // Check if QR code has expired
    if (new Date() > qrRecord.expiresAt) {
      await db.update(qrCodes).set({ status: 'EXPIRED' }).where(eq(qrCodes.id, qrId));
      return res.status(400).json({ success: false, message: 'QR code has expired' });
    }

    // Check if payer is trying to pay themselves
    if (payerId === qrRecord.userId) {
      return res.status(400).json({ success: false, message: 'Cannot pay yourself' });
    }

    const amount = parseFloat(qrRecord.amount);

    // Create transaction record
    const transaction = await db.insert(transactions).values({
      userId: payerId,
      recipientId: qrRecord.userId,
      type: 'QR_PAYMENT',
      status: 'SUCCESS',
      amount: amount.toString(),
      fee: '0.00',
      netAmount: amount.toString(),
      currency: 'NGN',
      description: `QR Payment: ${qrRecord.description}`,
      metadata: {
        qrId,
        paymentMethod
      },
      completedAt: new Date(),
      createdAt: new Date()
    }).returning();

    // Mark QR code as used
    await db.update(qrCodes).set({ 
      status: 'USED',
      usedAt: new Date(),
      usedBy: payerId
    }).where(eq(qrCodes.id, qrId));

    // Get merchant details
    const merchant = await db.select({
      fullName: users.fullName,
      email: users.email
    }).from(users).where(eq(users.id, qrRecord.userId)).limit(1);

    res.json({
      success: true,
      message: 'Payment successful',
      data: {
        transactionId: transaction[0].id,
        amount,
        recipient: merchant[0]?.fullName,
        description: qrRecord.description,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('QR payment error:', error);
    res.status(500).json({ success: false, message: 'Payment failed' });
  }
});

// Get QR code details
router.get('/:qrId', async (req, res) => {
  try {
    const { qrId } = req.params;

    const qrCode = await db.select({
      id: qrCodes.id,
      amount: qrCodes.amount,
      description: qrCodes.description,
      status: qrCodes.status,
      expiresAt: qrCodes.expiresAt,
      createdAt: qrCodes.createdAt,
      merchant: {
        fullName: users.fullName,
        email: users.email
      }
    })
    .from(qrCodes)
    .innerJoin(users, eq(qrCodes.userId, users.id))
    .where(eq(qrCodes.id, qrId))
    .limit(1);

    if (qrCode.length === 0) {
      return res.status(404).json({ success: false, message: 'QR code not found' });
    }

    const qrRecord = qrCode[0];

    // Check if expired
    if (new Date() > qrRecord.expiresAt && qrRecord.status === 'ACTIVE') {
      await db.update(qrCodes).set({ status: 'EXPIRED' }).where(eq(qrCodes.id, qrId));
      qrRecord.status = 'EXPIRED';
    }

    res.json({
      success: true,
      data: qrRecord
    });
  } catch (error) {
    console.error('Get QR code error:', error);
    res.status(500).json({ success: false, message: 'Failed to get QR code details' });
  }
});

// Get user's QR codes
router.get('/user/codes', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { status = 'all', limit = 20, page = 1 } = req.query;

    let whereCondition = eq(qrCodes.userId, userId);
    
    if (status !== 'all') {
      whereCondition = and(whereCondition, eq(qrCodes.status, status as string));
    }

    const userQrCodes = await db.select()
      .from(qrCodes)
      .where(whereCondition)
      .limit(parseInt(limit as string))
      .offset((parseInt(page as string) - 1) * parseInt(limit as string))
      .orderBy(qrCodes.createdAt);

    res.json({
      success: true,
      data: userQrCodes,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string)
      }
    });
  } catch (error) {
    console.error('Get user QR codes error:', error);
    res.status(500).json({ success: false, message: 'Failed to get QR codes' });
  }
});

// Cancel QR code
router.delete('/:qrId', authenticateToken, async (req, res) => {
  try {
    const { qrId } = req.params;
    const userId = (req as any).user.id;

    // Check if QR code belongs to user
    const qrCode = await db.select()
      .from(qrCodes)
      .where(and(eq(qrCodes.id, qrId), eq(qrCodes.userId, userId)))
      .limit(1);

    if (qrCode.length === 0) {
      return res.status(404).json({ success: false, message: 'QR code not found' });
    }

    if (qrCode[0].status !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'QR code cannot be cancelled' });
    }

    // Cancel QR code
    await db.update(qrCodes).set({ 
      status: 'CANCELLED',
      updatedAt: new Date()
    }).where(eq(qrCodes.id, qrId));

    res.json({
      success: true,
      message: 'QR code cancelled successfully'
    });
  } catch (error) {
    console.error('Cancel QR code error:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel QR code' });
  }
});

export default router;
