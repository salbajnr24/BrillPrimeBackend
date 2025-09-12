import { Router } from 'express';
import { eq, and, like, desc, or, sql } from 'drizzle-orm';
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

    let finalQuery = query;
    if (search) {
      finalQuery = db.select({
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
          eq(users.isVerified, true),
          like(users.fullName, `%${search}%`)
        ))
        .orderBy(desc(merchantProfiles.rating))
        .limit(Number(limit))
        .offset(offset);
    }

    const merchants = await finalQuery;

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

// Switch user role
router.put('/role', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { role } = req.body;

    // Validate role
    const validRoles = ['CONSUMER', 'MERCHANT', 'DRIVER'];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({ 
        error: 'Invalid role. Must be one of: CONSUMER, MERCHANT, DRIVER' 
      });
    }

    // Get current user to check existing role
    const currentUser = await db.select().from(users).where(eq(users.id, userId));
    
    if (currentUser.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user role
    const updatedUser = await db.update(users)
      .set({ role: role as any })
      .where(eq(users.id, userId))
      .returning();

    // Check if switching to MERCHANT and create profile if not exists
    if (role === 'MERCHANT') {
      const existingMerchantProfile = await db.select()
        .from(merchantProfiles)
        .where(eq(merchantProfiles.userId, userId));

      if (existingMerchantProfile.length === 0) {
        await db.insert(merchantProfiles).values({
          userId,
          businessName: updatedUser[0].fullName + "'s Business",
          businessType: 'OTHER',
          businessDescription: 'New merchant profile',
        });
      }
    }

    // Check if switching to DRIVER and create profile if not exists
    if (role === 'DRIVER') {
      const existingDriverProfile = await db.select()
        .from(driverProfiles)
        .where(eq(driverProfiles.userId, userId));

      if (existingDriverProfile.length === 0) {
        await db.insert(driverProfiles).values({
          userId,
          vehicleType: 'MOTORCYCLE',
          vehiclePlate: 'PENDING',
          driverLicense: 'PENDING',
        });
      }
    }

    res.json({
      message: `Role switched to ${role} successfully`,
      user: {
        id: updatedUser[0].id,
        userId: updatedUser[0].userId,
        fullName: updatedUser[0].fullName,
        email: updatedUser[0].email,
        role: updatedUser[0].role,
        previousRole: currentUser[0].role,
      },
    });
  } catch (error) {
    console.error('Switch role error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public user search (minimal information)
router.get('/search', async (req, res) => {
  try {
    const { q: query, type, page = 1, limit = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return res.status(400).json({ 
        error: 'Query parameter "q" is required and must be at least 2 characters' 
      });
    }

    const searchTerm = `%${query.trim()}%`;
    let whereConditions: any[] = [
      eq(users.isVerified, true),
    ];

    // Add search conditions
    whereConditions.push(
      or(
        like(users.fullName, searchTerm),
        like(users.email, searchTerm)
      )
    );

    // Filter by user type if specified
    if (type && ['CONSUMER', 'MERCHANT', 'DRIVER'].includes(type as string)) {
      whereConditions.push(eq(users.role, type as any));
    }

    // Base user query
    let userQuery = db.select({
      id: users.id,
      userId: users.userId,
      fullName: users.fullName,
      email: users.email,
      role: users.role,
      profilePicture: users.profilePicture,
      city: users.city,
      state: users.state,
      isVerified: users.isVerified,
      createdAt: users.createdAt,
    })
      .from(users)
      .where(and(...whereConditions))
      .limit(Number(limit))
      .offset(offset);

    const searchResults = await userQuery;

    // For merchants, get additional business info
    const merchantIds = searchResults
      .filter(user => user.role === 'MERCHANT')
      .map(user => user.id);

    let merchantProfilesData: any[] = [];
    if (merchantIds.length > 0) {
      merchantProfilesData = await db.select({
        userId: merchantProfiles.userId,
        businessName: merchantProfiles.businessName,
        businessType: merchantProfiles.businessType,
        rating: merchantProfiles.rating,
        reviewCount: merchantProfiles.reviewCount,
        isVerified: merchantProfiles.isVerified,
      })
        .from(merchantProfiles)
        .where(and(
          sql`${merchantProfiles.userId} IN (${merchantIds.join(',')})`,
          like(merchantProfiles.businessName, searchTerm)
        ));
    }

    // Combine results
    const enhancedResults = searchResults.map(user => {
      const result: any = {
        id: user.id,
        userId: user.userId,
        fullName: user.fullName,
        role: user.role,
        profilePicture: user.profilePicture,
        city: user.city,
        state: user.state,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
      };

      // Add merchant info if applicable
      if (user.role === 'MERCHANT') {
        const merchantProfile = merchantProfilesData.find(mp => mp.userId === user.id);
        if (merchantProfile) {
          result.merchantInfo = {
            businessName: merchantProfile.businessName,
            businessType: merchantProfile.businessType,
            rating: merchantProfile.rating,
            reviewCount: merchantProfile.reviewCount,
            isVerified: merchantProfile.isVerified,
          };
        }
      }

      return result;
    });

    res.json({
      results: enhancedResults,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: searchResults.length,
        hasMore: searchResults.length === Number(limit),
      },
      searchQuery: query,
      searchType: type || 'ALL',
    });
  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;