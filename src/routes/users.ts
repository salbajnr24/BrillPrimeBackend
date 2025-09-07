import { Router } from 'express';
import { eq, and, like, desc } from 'drizzle-orm';
import db from '../config/database';
import { users, merchantProfiles, driverProfiles, userLocations } from '../schema';
import { authenticateToken, authorizeRoles } from '../utils/auth';

const router = Router();

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    const user = await db.select({
      id: users.id,
      userId: users.userId,
      fullName: users.fullName,
      email: users.email,
      phone: users.phone,
      role: users.role,
      isVerified: users.isVerified,
      isPhoneVerified: users.isPhoneVerified,
      isIdentityVerified: users.isIdentityVerified,
      profilePicture: users.profilePicture,
      address: users.address,
      city: users.city,
      state: users.state,
      country: users.country,
      bio: users.bio,
      createdAt: users.createdAt,
    }).from(users).where(eq(users.id, userId));

    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user[0]);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { fullName, phone, address, city, state, country, bio, profilePicture } = req.body;

    const updatedUser = await db.update(users)
      .set({
        fullName,
        phone,
        address,
        city,
        state,
        country,
        bio,
        profilePicture,
      })
      .where(eq(users.id, userId))
      .returning();

    if (updatedUser.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser[0].id,
        userId: updatedUser[0].userId,
        fullName: updatedUser[0].fullName,
        email: updatedUser[0].email,
        phone: updatedUser[0].phone,
        role: updatedUser[0].role,
        address: updatedUser[0].address,
        city: updatedUser[0].city,
        state: updatedUser[0].state,
        country: updatedUser[0].country,
        bio: updatedUser[0].bio,
        profilePicture: updatedUser[0].profilePicture,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all merchants (public)
router.get('/merchants', async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = db.select({
      id: users.id,
      userId: users.userId,
      fullName: users.fullName,
      email: users.email,
      profilePicture: users.profilePicture,
      city: users.city,
      state: users.state,
      isVerified: users.isVerified,
      merchantProfile: {
        businessName: merchantProfiles.businessName,
        businessType: merchantProfiles.businessType,
        businessDescription: merchantProfiles.businessDescription,
        businessLogo: merchantProfiles.businessLogo,
        rating: merchantProfiles.rating,
        reviewCount: merchantProfiles.reviewCount,
        totalSales: merchantProfiles.totalSales,
        totalOrders: merchantProfiles.totalOrders,
        isVerified: merchantProfiles.isVerified,
        subscriptionTier: merchantProfiles.subscriptionTier,
      },
    })
      .from(users)
      .leftJoin(merchantProfiles, eq(users.id, merchantProfiles.userId))
      .where(and(
        eq(users.role, 'MERCHANT'),
        eq(users.isVerified, true)
      ))
      .orderBy(desc(merchantProfiles.rating))
      .limit(Number(limit))
      .offset(offset);

    if (search) {
      query = query.where(and(
        eq(users.role, 'MERCHANT'),
        eq(users.isVerified, true),
        like(users.fullName, `%${search}%`)
      ));
    }

    const merchants = await query;

    res.json({
      merchants,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: merchants.length,
      },
    });
  } catch (error) {
    console.error('Get merchants error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get merchant details by ID
router.get('/merchants/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const merchant = await db.select({
      id: users.id,
      userId: users.userId,
      fullName: users.fullName,
      email: users.email,
      phone: users.phone,
      profilePicture: users.profilePicture,
      address: users.address,
      city: users.city,
      state: users.state,
      country: users.country,
      bio: users.bio,
      createdAt: users.createdAt,
      merchantProfile: merchantProfiles,
    })
      .from(users)
      .leftJoin(merchantProfiles, eq(users.id, merchantProfiles.userId))
      .where(and(
        eq(users.id, Number(id)),
        eq(users.role, 'MERCHANT'),
        eq(users.isVerified, true)
      ));

    if (merchant.length === 0) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    res.json(merchant[0]);
  } catch (error) {
    console.error('Get merchant details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update merchant profile
router.put('/merchant-profile', authenticateToken, authorizeRoles('MERCHANT'), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const {
      businessName,
      businessType,
      businessDescription,
      businessAddress,
      businessPhone,
      businessEmail,
      businessLogo,
      businessHours,
    } = req.body;

    // Check if merchant profile exists
    const existingProfile = await db.select().from(merchantProfiles).where(eq(merchantProfiles.userId, userId));

    let profile;
    if (existingProfile.length === 0) {
      // Create new profile
      profile = await db.insert(merchantProfiles).values({
        userId,
        businessName,
        businessType,
        businessDescription,
        businessAddress,
        businessPhone,
        businessEmail,
        businessLogo,
        businessHours,
      }).returning();
    } else {
      // Update existing profile
      profile = await db.update(merchantProfiles)
        .set({
          businessName,
          businessType,
          businessDescription,
          businessAddress,
          businessPhone,
          businessEmail,
          businessLogo,
          businessHours,
        })
        .where(eq(merchantProfiles.userId, userId))
        .returning();
    }

    res.json({
      message: 'Merchant profile updated successfully',
      profile: profile[0],
    });
  } catch (error) {
    console.error('Update merchant profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update driver profile
router.put('/driver-profile', authenticateToken, authorizeRoles('DRIVER'), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const {
      driverTier,
      accessLevel,
      vehicleType,
      vehiclePlate,
      vehicleModel,
      vehicleYear,
      driverLicense,
      vehicleDocuments,
      serviceTypes,
      specializations,
    } = req.body;

    // Check if driver profile exists
    const existingProfile = await db.select().from(driverProfiles).where(eq(driverProfiles.userId, userId));

    let profile;
    if (existingProfile.length === 0) {
      // Create new profile
      profile = await db.insert(driverProfiles).values({
        userId,
        driverTier,
        accessLevel,
        vehicleType,
        vehiclePlate,
        vehicleModel,
        vehicleYear,
        driverLicense,
        vehicleDocuments,
        serviceTypes,
        specializations,
      }).returning();
    } else {
      // Update existing profile
      profile = await db.update(driverProfiles)
        .set({
          driverTier,
          accessLevel,
          vehicleType,
          vehiclePlate,
          vehicleModel,
          vehicleYear,
          driverLicense,
          vehicleDocuments,
          serviceTypes,
          specializations,
        })
        .where(eq(driverProfiles.userId, userId))
        .returning();
    }

    res.json({
      message: 'Driver profile updated successfully',
      profile: profile[0],
    });
  } catch (error) {
    console.error('Update driver profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user location
router.post('/location', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { latitude, longitude, address } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    // Deactivate previous locations
    await db.update(userLocations)
      .set({ isActive: false })
      .where(eq(userLocations.userId, userId));

    // Insert new location
    const location = await db.insert(userLocations).values({
      userId,
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      address,
      isActive: true,
    }).returning();

    res.json({
      message: 'Location updated successfully',
      location: location[0],
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;