import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import db from '../config/database';
import { users, otpCodes, merchantProfiles, driverProfiles } from '../schema';
import { hashPassword, comparePassword, generateToken, generateOTP, authenticateToken } from '../utils/auth';
import { sendOTPEmail, sendWelcomeEmail } from '../utils/mailer';
import { v4 as uuidv4 } from 'uuid';
import { 
  SignUpDto, 
  SignInDto, 
  ChangePasswordDto, 
  ForgotPasswordDto, 
  ResetPasswordDto, 
  VerifyOtpDto 
} from '../types/auth';
import { 
  validateSignUp, 
  validateSignIn, 
  validateChangePassword, 
  validateForgotPassword, 
  validateResetPassword, 
  validateVerifyOtp 
} from '../utils/validation';

const router = Router();

// Register endpoint
router.post('/register', async (req, res) => {
  try {
    const { fullName, email, phone, password, role } = req.body;

    if (!fullName || !email || !phone || !password || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (!['CONSUMER', 'MERCHANT', 'DRIVER'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Check if user already exists
    const existingUser = await db.select().from(users).where(eq(users.email, email));
    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Generate unique user ID
    const userIdNumber = Math.floor(Math.random() * 900000) + 100000;
    const userId = `BP-${userIdNumber.toString().padStart(6, '0')}`;

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const newUser = await db.insert(users).values({
      userId,
      fullName,
      email,
      phone,
      password: hashedPassword,
      role: role as 'CONSUMER' | 'MERCHANT' | 'DRIVER',
    }).returning();

    // Generate and send OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await db.insert(otpCodes).values({
      email,
      code:otp,
      expiresAt,
    });

    await sendOTPEmail(email, otp);

    res.status(201).json({
      message: 'User registered successfully. Please verify your email with the OTP sent.',
      userId: newUser[0].id,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify OTP endpoint
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    // Find valid OTP
    const otpRecord = await db.select()
      .from(otpCodes)
      .where(and(
        eq(otpCodes.email, email),
        eq(otpCodes.code, otp),
        eq(otpCodes.isUsed, false)
      ));

    if (otpRecord.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const otp_record = otpRecord[0];

    // Check if OTP is expired
    if (new Date() > otp_record.expiresAt) {
      return res.status(400).json({ error: 'OTP has expired' });
    }

    // Mark OTP as used
    await db.update(otpCodes)
      .set({ isUsed: true })
      .where(eq(otpCodes.id, otp_record.id));

    // Verify user
    const user = await db.update(users)
      .set({ isVerified: true })
      .where(eq(users.email, email))
      .returning();

    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Send welcome email
    await sendWelcomeEmail(email, user[0].fullName);

    // Generate JWT token
    const token = generateToken({
      userId: user[0].id,
      email: user[0].email,
      role: user[0].role as 'CONSUMER' | 'MERCHANT' | 'DRIVER',
    });

    res.json({
      message: 'Email verified successfully',
      token,
      user: {
        id: user[0].id,
        userId: user[0].userId,
        fullName: user[0].fullName,
        email: user[0].email,
        role: user[0].role,
        isVerified: user[0].isVerified,
      },
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await db.select().from(users).where(eq(users.email, email));
    if (user.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const foundUser = user[0];

    // Check password
    const isPasswordValid = await comparePassword(password, foundUser.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!foundUser.isVerified) {
      return res.status(401).json({ error: 'Please verify your email first' });
    }

    // Generate JWT token
    const token = generateToken({
      userId: foundUser.id,
      email: foundUser.email,
      role: foundUser.role as 'CONSUMER' | 'MERCHANT' | 'DRIVER',
    });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: foundUser.id,
        userId: foundUser.userId,
        fullName: foundUser.fullName,
        email: foundUser.email,
        role: foundUser.role,
        isVerified: foundUser.isVerified,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Resend OTP endpoint
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if user exists
    const user = await db.select().from(users).where(eq(users.email, email));
    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user[0].isVerified) {
      return res.status(400).json({ error: 'User is already verified' });
    }

    // Generate new OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await db.insert(otpCodes).values({
      email,
      code: otp,
      expiresAt,
    });

    await sendOTPEmail(email, otp);

    res.json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;