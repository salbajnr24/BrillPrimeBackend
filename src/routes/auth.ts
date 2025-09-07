import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import db from '../config/database';
import { users, otpCodes, merchantProfiles, driverProfiles, mfaConfigurations } from '../schema';
import { hashPassword, comparePassword, generateToken, generateOTP, authenticateToken } from '../utils/auth';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
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

// Forgot password endpoint
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if user exists
    const user = await db.select().from(users).where(eq(users.email, email));
    if (user.length === 0) {
      // Don't reveal if user exists or not for security
      return res.json({ message: 'If an account with this email exists, a reset link will be sent.' });
    }

    // Generate reset OTP
    const resetOTP = generateOTP();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await db.insert(otpCodes).values({
      email,
      code: resetOTP,
      expiresAt,
    });

    // Send reset OTP email
    await sendOTPEmail(email, resetOTP);

    res.json({ message: 'If an account with this email exists, a reset link will be sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset password endpoint
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'Email, OTP, and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
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

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update user password
    const updatedUser = await db.update(users)
      .set({ password: hashedPassword })
      .where(eq(users.email, email))
      .returning();

    if (updatedUser.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Mark OTP as used
    await db.update(otpCodes)
      .set({ isUsed: true })
      .where(eq(otpCodes.id, otp_record.id));

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change password endpoint (requires authentication)
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = (req as any).user.userId;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    // Get user
    const user = await db.select().from(users).where(eq(users.id, userId));
    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const foundUser = user[0];

    // Verify current password
    const isCurrentPasswordValid = await comparePassword(currentPassword, foundUser.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedNewPassword = await hashPassword(newPassword);

    // Update password
    await db.update(users)
      .set({ password: hashedNewPassword })
      .where(eq(users.id, userId));

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Initiate MFA setup endpoint
router.post('/initiate-mfa', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    // Get user info for generating QR code
    const user = await db.select().from(users).where(eq(users.id, userId));
    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const foundUser = user[0];

    // Check if MFA is already enabled
    const existingMfa = await db.select().from(mfaConfigurations).where(eq(mfaConfigurations.userId, userId));
    
    if (existingMfa.length > 0 && existingMfa[0].isEnabled) {
      return res.status(400).json({ error: 'MFA is already enabled for this account' });
    }

    // Generate new secret
    const secret = speakeasy.generateSecret({
      name: `BrillPrime (${foundUser.email})`,
      issuer: 'BrillPrime',
      length: 32
    });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

    // Store secret (not yet enabled)
    if (existingMfa.length > 0) {
      await db.update(mfaConfigurations)
        .set({ secret: secret.base32, isEnabled: false, updatedAt: new Date() })
        .where(eq(mfaConfigurations.userId, userId));
    } else {
      await db.insert(mfaConfigurations).values({
        userId,
        secret: secret.base32,
        isEnabled: false
      });
    }

    res.json({
      secret: secret.base32,
      qrCode: qrCodeUrl,
      manualEntryKey: secret.base32,
      message: 'Scan the QR code with your authenticator app, then verify with setup-mfa endpoint'
    });
  } catch (error) {
    console.error('Initiate MFA error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Complete MFA setup endpoint
router.post('/setup-mfa', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { token } = req.body;

    // Get user info for generating QR code
    const user = await db.select().from(users).where(eq(users.id, userId));
    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const foundUser = user[0];

    if (!token) {
      // Generate new secret and return QR code for setup
      const secret = speakeasy.generateSecret({
        name: `BrillPrime (${foundUser.email})`,
        issuer: 'BrillPrime',
        length: 32
      });

      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

      return res.json({
        secret: secret.base32,
        qrCode: qrCodeUrl,
        manualEntryKey: secret.base32,
        message: 'Scan the QR code with your authenticator app and verify with a token'
      });
    }

    // Verify the token to complete setup
    const existingMfa = await db.select().from(mfaConfigurations).where(eq(mfaConfigurations.userId, userId));
    
    if (existingMfa.length === 0) {
      return res.status(400).json({ error: 'No MFA setup in progress. Please start setup first.' });
    }

    const verified = speakeasy.totp.verify({
      secret: existingMfa[0].secret,
      encoding: 'base32',
      token,
      window: 2
    });

    if (!verified) {
      return res.status(400).json({ error: 'Invalid MFA token' });
    }

    // Generate backup codes
    const backupCodes = Array.from({ length: 8 }, () => 
      Math.random().toString(36).substring(2, 10).toUpperCase()
    );

    // Enable MFA
    await db.update(mfaConfigurations)
      .set({ 
        isEnabled: true,
        backupCodes,
        updatedAt: new Date()
      })
      .where(eq(mfaConfigurations.userId, userId));

    res.json({ 
      message: 'MFA setup completed successfully',
      backupCodes
    });
  } catch (error) {
    console.error('Setup MFA error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify MFA endpoint
router.post('/verify-mfa', async (req, res) => {
  try {
    const { email, password, mfaToken } = req.body;

    if (!email || !password || !mfaToken) {
      return res.status(400).json({ error: 'Email, password, and MFA token are required' });
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

    // Check if user has MFA enabled
    const mfaConfig = await db.select().from(mfaConfigurations).where(eq(mfaConfigurations.userId, foundUser.id));
    
    if (mfaConfig.length === 0 || !mfaConfig[0].isEnabled) {
      return res.status(400).json({ error: 'MFA is not enabled for this account' });
    }

    const mfa = mfaConfig[0];

    // Verify TOTP token
    const verified = speakeasy.totp.verify({
      secret: mfa.secret,
      encoding: 'base32',
      token: mfaToken,
      window: 2
    });

    // Check backup codes if TOTP fails
    let isBackupCode = false;
    if (!verified && mfa.backupCodes && mfa.backupCodes.includes(mfaToken)) {
      isBackupCode = true;
      // Remove used backup code
      const updatedBackupCodes = mfa.backupCodes.filter(code => code !== mfaToken);
      await db.update(mfaConfigurations)
        .set({ 
          backupCodes: updatedBackupCodes,
          lastUsedAt: new Date()
        })
        .where(eq(mfaConfigurations.userId, foundUser.id));
    }

    if (!verified && !isBackupCode) {
      return res.status(400).json({ error: 'Invalid MFA token or backup code' });
    }

    // Update last used timestamp
    if (verified) {
      await db.update(mfaConfigurations)
        .set({ lastUsedAt: new Date() })
        .where(eq(mfaConfigurations.userId, foundUser.id));
    }

    // Generate JWT token
    const token = generateToken({
      userId: foundUser.id,
      email: foundUser.email,
      role: foundUser.role as 'CONSUMER' | 'MERCHANT' | 'DRIVER',
    });

    res.json({
      message: 'MFA verification successful',
      token,
      user: {
        id: foundUser.id,
        userId: foundUser.userId,
        fullName: foundUser.fullName,
        email: foundUser.email,
        role: foundUser.role,
        isVerified: foundUser.isVerified,
      },
      usedBackupCode: isBackupCode
    });
  } catch (error) {
    console.error('Verify MFA error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Disable MFA endpoint
router.post('/disable-mfa', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { password, mfaToken } = req.body;

    if (!password || !mfaToken) {
      return res.status(400).json({ error: 'Password and MFA token are required' });
    }

    // Get user
    const user = await db.select().from(users).where(eq(users.id, userId));
    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const foundUser = user[0];

    // Verify current password
    const isPasswordValid = await comparePassword(password, foundUser.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid password' });
    }

    // Check if user has MFA enabled
    const mfaConfig = await db.select().from(mfaConfigurations).where(eq(mfaConfigurations.userId, userId));
    
    if (mfaConfig.length === 0 || !mfaConfig[0].isEnabled) {
      return res.status(400).json({ error: 'MFA is not enabled for this account' });
    }

    const mfa = mfaConfig[0];

    // Verify TOTP token or backup code
    const verified = speakeasy.totp.verify({
      secret: mfa.secret,
      encoding: 'base32',
      token: mfaToken,
      window: 2
    });

    const isBackupCode = mfa.backupCodes && mfa.backupCodes.includes(mfaToken);

    if (!verified && !isBackupCode) {
      return res.status(400).json({ error: 'Invalid MFA token or backup code' });
    }

    // Disable MFA
    await db.update(mfaConfigurations)
      .set({ 
        isEnabled: false,
        backupCodes: [],
        updatedAt: new Date()
      })
      .where(eq(mfaConfigurations.userId, userId));

    res.json({ message: 'MFA disabled successfully' });
  } catch (error) {
    console.error('Disable MFA error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get MFA status endpoint
router.get('/mfa-status', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    const mfaConfig = await db.select().from(mfaConfigurations).where(eq(mfaConfigurations.userId, userId));
    
    const isEnabled = mfaConfig.length > 0 && mfaConfig[0].isEnabled;
    const backupCodesCount = isEnabled && mfaConfig[0].backupCodes ? mfaConfig[0].backupCodes.length : 0;

    res.json({ 
      mfaEnabled: isEnabled,
      backupCodesRemaining: backupCodesCount,
      lastUsed: isEnabled ? mfaConfig[0].lastUsedAt : null
    });
  } catch (error) {
    console.error('Get MFA status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;