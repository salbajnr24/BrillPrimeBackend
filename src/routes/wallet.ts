
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

// Create wallet endpoint
router.post('/create', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // Check if wallet already exists
    const existingWallet = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, parseInt(userId)))
      .limit(1);

    if (existingWallet.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Wallet already exists for this user'
      });
    }

    const newWallet = await db
      .insert(wallets)
      .values({
        userId: parseInt(userId),
        balance: '0.00'
      })
      .returning();

    res.status(201).json({
      success: true,
      message: 'Wallet created successfully',
      data: newWallet[0]
    });
  } catch (error) {
    console.error('Error creating wallet:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create wallet'
    });
  }
});

// Get wallet balance
router.get('/balance', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const userWallet = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, parseInt(userId as string)))
      .limit(1);

    if (userWallet.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
    }

    res.json({
      success: true,
      data: {
        balance: userWallet[0].balance,
        userId: userWallet[0].userId
      }
    });
  } catch (error) {
    console.error('Error fetching wallet balance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wallet balance'
    });
  }
});

// Deposit funds
router.post('/deposit', async (req, res) => {
  try {
    const { userId, amount, paymentMethod, transactionRef } = req.body;

    if (!userId || !amount || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'User ID, amount, and payment method are required'
      });
    }

    // Create transaction record
    const transaction = await db
      .insert(transactions)
      .values({
        userId: parseInt(userId),
        amount: amount.toString(),
        type: 'WALLET_FUNDING',
        paymentMethod,
        transactionRef: transactionRef || `DEP_${Date.now()}`,
        description: 'Wallet deposit',
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
      message: 'Deposit successful',
      data: transaction[0]
    });
  } catch (error) {
    console.error('Error processing deposit:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process deposit'
    });
  }
});

// Withdraw funds
router.post('/withdraw', async (req, res) => {
  try {
    const { userId, amount, withdrawalMethod } = req.body;

    if (!userId || !amount || !withdrawalMethod) {
      return res.status(400).json({
        success: false,
        message: 'User ID, amount, and withdrawal method are required'
      });
    }

    // Check wallet balance
    const currentWallet = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, parseInt(userId)))
      .limit(1);

    if (currentWallet.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
    }

    const currentBalance = parseFloat(currentWallet[0].balance || '0');
    const withdrawalAmount = parseFloat(amount);

    if (currentBalance < withdrawalAmount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance'
      });
    }

    // Create withdrawal transaction
    const transaction = await db
      .insert(transactions)
      .values({
        userId: parseInt(userId),
        amount: amount.toString(),
        type: 'WITHDRAWAL',
        paymentMethod: withdrawalMethod,
        transactionRef: `WTH_${Date.now()}`,
        description: 'Wallet withdrawal',
        status: 'PENDING'
      })
      .returning();

    // Update wallet balance
    const newBalance = currentBalance - withdrawalAmount;
    await db
      .update(wallets)
      .set({ 
        balance: newBalance.toString(),
        updatedAt: new Date()
      })
      .where(eq(wallets.userId, parseInt(userId)));

    res.json({
      success: true,
      message: 'Withdrawal initiated successfully',
      data: transaction[0]
    });
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process withdrawal'
    });
  }
});

// Get transaction history
router.get('/history', async (req, res) => {
  try {
    const { userId, limit = 20, offset = 0 } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const userTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, parseInt(userId as string)))
      .orderBy(desc(transactions.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    res.json({
      success: true,
      data: userTransactions
    });
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transaction history'
    });
  }
});

export default router;
