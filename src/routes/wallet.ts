
import { Router } from 'express';
import { db } from '../config/database';
import { wallets, transactions, users } from '../schema';
import { eq, desc } from 'drizzle-orm';

const router = Router();

// Get user wallet
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const userWallet = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, parseInt(userId)))
      .limit(1);

    if (userWallet.length === 0) {
      // Create wallet if it doesn't exist
      const newWallet = await db
        .insert(wallets)
        .values({
          userId: parseInt(userId),
          balance: '0.00'
        })
        .returning();
      
      return res.json({
        success: true,
        data: newWallet[0]
      });
    }

    res.json({
      success: true,
      data: userWallet[0]
    });
  } catch (error) {
    console.error('Error fetching wallet:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wallet'
    });
  }
});

// Get wallet transactions
router.get('/:userId/transactions', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    
    const userTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, parseInt(userId)))
      .orderBy(desc(transactions.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    res.json({
      success: true,
      data: userTransactions
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions'
    });
  }
});

// Fund wallet
router.post('/:userId/fund', async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount, paymentMethod, transactionRef } = req.body;

    // Create transaction record
    const transaction = await db
      .insert(transactions)
      .values({
        userId: parseInt(userId),
        amount: amount.toString(),
        type: 'WALLET_FUNDING',
        paymentMethod,
        transactionRef,
        description: 'Wallet funding',
        status: 'COMPLETED'
      })
      .returning();

    // Update wallet balance
    const currentWallet = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, parseInt(userId)))
      .limit(1);

    if (currentWallet.length > 0) {
      const currentBalance = parseFloat(currentWallet[0].balance || '0');
      const newBalance = currentBalance + parseFloat(amount);
      
      await db
        .update(wallets)
        .set({ 
          balance: newBalance.toString(),
          updatedAt: new Date()
        })
        .where(eq(wallets.userId, parseInt(userId)));
    }

    res.json({
      success: true,
      message: 'Wallet funded successfully',
      data: transaction[0]
    });
  } catch (error) {
    console.error('Error funding wallet:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fund wallet'
    });
  }
});

export default router;
