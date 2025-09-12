
import { Router } from 'express';
import { eq } from 'drizzle-orm';
import db from '../config/database';
import { users } from '../schema';
import { comparePassword, generateToken } from '../utils/auth';
import { fraudDetectionMiddleware } from '../utils/fraud-middleware';

const router = Router();

// Admin-specific login endpoint
router.post('/login', fraudDetectionMiddleware('ADMIN_LOGIN') as any, async (req: any, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user and verify they are an admin
    const user = await db.select().from(users).where(eq(users.email, email));
    if (user.length === 0) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    const foundUser = user[0];

    // Check if user has admin role
    if (foundUser.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }

    // Check password
    const isPasswordValid = await comparePassword(password, foundUser.password || '');
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    if (!foundUser.isVerified) {
      return res.status(401).json({ error: 'Admin account not verified' });
    }

    // Generate JWT token with admin role
    const token = generateToken({
      userId: foundUser.id,
      email: foundUser.email,
      role: 'ADMIN',
    });

    res.json({
      message: 'Admin login successful',
      token,
      admin: {
        id: foundUser.id,
        userId: foundUser.userId,
        fullName: foundUser.fullName,
        email: foundUser.email,
        role: foundUser.role,
        isVerified: foundUser.isVerified,
      },
      redirectTo: '/admin/dashboard', // Specific admin dashboard route
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin logout endpoint
router.post('/logout', async (req, res) => {
  try {
    // In a more advanced setup, you might want to blacklist the token
    res.json({ 
      message: 'Admin logged out successfully',
      redirectTo: '/admin/login'
    });
  } catch (error) {
    console.error('Admin logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin password reset (separate from regular users)
router.post('/reset-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if user exists and is an admin
    const user = await db.select().from(users).where(eq(users.email, email));
    if (user.length === 0 || user[0].role !== 'ADMIN') {
      // Don't reveal if admin exists for security
      return res.json({ message: 'If an admin account with this email exists, a reset link will be sent.' });
    }

    // TODO: Implement admin-specific password reset logic
    // This could involve sending emails to a different template
    // or requiring additional verification steps

    res.json({ message: 'If an admin account with this email exists, a reset link will be sent.' });
  } catch (error) {
    console.error('Admin password reset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
