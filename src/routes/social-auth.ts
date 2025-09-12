
import { Router } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { eq } from 'drizzle-orm';
import db from '../config/database';
import { users } from '../schema';
import { generateToken } from '../utils/auth';
import { sendWelcomeEmail } from '../utils/mailer';

const router = Router();

// Configure Google OAuth Strategy (only if credentials are provided)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/api/social-auth/google/callback"
  }, async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if user exists
    const existingUser = await db.select().from(users).where(eq(users.email, profile.emails![0].value));
    
    if (existingUser.length > 0) {
      // User exists, return user
      return done(null, existingUser[0]);
    }

    // Create new user
    const userIdNumber = Math.floor(Math.random() * 900000) + 100000;
    const userId = `BP-${userIdNumber.toString().padStart(6, '0')}`;

    const newUser = await db.insert(users).values({
      userId,
      fullName: profile.displayName || '',
      email: profile.emails![0].value,
      profilePicture: profile.photos![0].value,
      isVerified: true, // Auto-verify social auth users
      role: 'CONSUMER',
      socialAuth: {
        provider: 'google',
        providerId: profile.id
      }
    }).returning();

    await sendWelcomeEmail(newUser[0].email, newUser[0].fullName);
    return done(null, newUser[0]);
  } catch (error) {
    return done(error, false);
  }
  }));
}

// Configure Facebook OAuth Strategy (only if credentials are provided)
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_APP_ID || '',
  clientSecret: process.env.FACEBOOK_APP_SECRET || '',
  callbackURL: "/api/social-auth/facebook/callback",
  profileFields: ['id', 'displayName', 'photos', 'email']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const existingUser = await db.select().from(users).where(eq(users.email, profile.emails![0].value));
    
    if (existingUser.length > 0) {
      return done(null, existingUser[0]);
    }

    const userIdNumber = Math.floor(Math.random() * 900000) + 100000;
    const userId = `BP-${userIdNumber.toString().padStart(6, '0')}`;

    const newUser = await db.insert(users).values({
      userId,
      fullName: profile.displayName || '',
      email: profile.emails![0].value,
      profilePicture: profile.photos![0].value,
      isVerified: true,
      role: 'CONSUMER',
      socialAuth: {
        provider: 'facebook',
        providerId: profile.id
      }
    }).returning();

    await sendWelcomeEmail(newUser[0].email, newUser[0].fullName);
    return done(null, newUser[0]);
  } catch (error) {
    return done(error, false);
  }
  }));
}

// Google OAuth routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', 
  passport.authenticate('google', { session: false }),
  (req, res) => {
    const user = req.user as any;
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3001'}/auth/callback?token=${token}`);
  }
);

// Facebook OAuth routes
router.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }));

router.get('/facebook/callback',
  passport.authenticate('facebook', { session: false }),
  (req, res) => {
    const user = req.user as any;
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3001'}/auth/callback?token=${token}`);
  }
);

// Apple Sign-In endpoint (handled via JWT verification)
router.post('/apple', async (req, res) => {
  try {
    const { identityToken, user } = req.body;

    if (!identityToken) {
      return res.status(400).json({ error: 'Identity token is required' });
    }

    // Note: In production, you should verify the Apple JWT token
    // For now, we'll assume it's valid and extract user info
    const email = user?.email;
    const fullName = user?.name ? `${user.name.firstName} ${user.name.lastName}` : '';

    if (!email) {
      return res.status(400).json({ error: 'Email is required from Apple Sign-In' });
    }

    // Check if user exists
    const existingUser = await db.select().from(users).where(eq(users.email, email));
    
    let userData;
    if (existingUser.length > 0) {
      userData = existingUser[0];
    } else {
      // Create new user
      const userIdNumber = Math.floor(Math.random() * 900000) + 100000;
      const userId = `BP-${userIdNumber.toString().padStart(6, '0')}`;

      const newUser = await db.insert(users).values({
        userId,
        fullName,
        email,
        isVerified: true,
        role: 'CONSUMER',
        socialAuth: {
          provider: 'apple',
          providerId: user?.sub || email
        }
      }).returning();

      userData = newUser[0];
      await sendWelcomeEmail(userData.email, userData.fullName);
    }

    const token = generateToken({
      userId: userData.id,
      email: userData.email,
      role: userData.role as any
    });

    res.json({
      message: 'Apple Sign-In successful',
      token,
      user: {
        id: userData.id,
        userId: userData.userId,
        fullName: userData.fullName,
        email: userData.email,
        role: userData.role,
        isVerified: userData.isVerified,
      }
    });
  } catch (error) {
    console.error('Apple Sign-In error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
