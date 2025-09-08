
import { Router } from 'express';
import { eq, and, like, sql, desc, asc } from 'drizzle-orm';
import db from '../config/database';
import { products, categories, users, merchantProfiles } from '../schema';
import { authenticateToken } from '../utils/auth';

const router = Router();

// Advanced search with filters
router.get('/products', async (req, res) => {
  try {
    const {
      q = '', // search query
      category,
      minPrice,
      maxPrice,
      rating,
      location,
      latitude,
      longitude,
      radius = 10, // km
      sortBy = 'relevance',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
      inStock,
      merchantId
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    let whereConditions = [eq(products.isActive, true)];

    // Text search
    if (q) {
      whereConditions.push(
        sql`(${products.name} ILIKE ${`%${q}%`} OR ${products.description} ILIKE ${`%${q}%`})`
      );
    }

    // Category filter
    if (category) {
      whereConditions.push(eq(products.categoryId, Number(category)));
    }

    // Price range filter
    if (minPrice) {
      whereConditions.push(sql`CAST(${products.price} AS DECIMAL) >= ${Number(minPrice)}`);
    }
    if (maxPrice) {
      whereConditions.push(sql`CAST(${products.price} AS DECIMAL) <= ${Number(maxPrice)}`);
    }

    // Rating filter
    if (rating) {
      whereConditions.push(sql`CAST(${products.rating} AS DECIMAL) >= ${Number(rating)}`);
    }

    // Stock filter
    if (inStock !== undefined) {
      whereConditions.push(eq(products.inStock, inStock === 'true'));
    }

    // Merchant filter
    if (merchantId) {
      whereConditions.push(eq(products.sellerId, Number(merchantId)));
    }

    let selectQuery = db.select({
      id: products.id,
      name: products.name,
      description: products.description,
      price: products.price,
      unit: products.unit,
      image: products.image,
      rating: products.rating,
      reviewCount: products.reviewCount,
      inStock: products.inStock,
      minimumOrder: products.minimumOrder,
      createdAt: products.createdAt,
      category: {
        id: categories.id,
        name: categories.name,
        icon: categories.icon,
        slug: categories.slug,
      },
      seller: {
        id: users.id,
        userId: users.userId,
        fullName: users.fullName,
        profilePicture: users.profilePicture,
        city: users.city,
        state: users.state,
        latitude: users.latitude,
        longitude: users.longitude,
      },
      merchant: {
        businessName: merchantProfiles.businessName,
        businessAddress: merchantProfiles.businessAddress,
        rating: merchantProfiles.rating,
      },
      distance: latitude && longitude ? 
        sql<number>`6371 * acos(cos(radians(${Number(latitude)})) * cos(radians(CAST(${users.latitude} AS DECIMAL))) * cos(radians(CAST(${users.longitude} AS DECIMAL)) - radians(${Number(longitude)})) + sin(radians(${Number(latitude)})) * sin(radians(CAST(${users.latitude} AS DECIMAL))))` : 
        sql<number>`0`
    })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(users, eq(products.sellerId, users.id))
      .leftJoin(merchantProfiles, eq(users.id, merchantProfiles.userId))
      .where(and(...whereConditions));

    // Geo-location filter
    if (latitude && longitude && radius) {
      selectQuery = (selectQuery as any).having(
        sql`6371 * acos(cos(radians(${Number(latitude)})) * cos(radians(CAST(${users.latitude} AS DECIMAL))) * cos(radians(CAST(${users.longitude} AS DECIMAL)) - radians(${Number(longitude)})) + sin(radians(${Number(latitude)})) * sin(radians(CAST(${users.latitude} AS DECIMAL)))) <= ${Number(radius)}`
      );
    }

    // Sorting
    switch (sortBy) {
      case 'price':
        selectQuery = (selectQuery as any).orderBy(
          sortOrder === 'asc' ? asc(sql`CAST(${products.price} AS DECIMAL)`) : desc(sql`CAST(${products.price} AS DECIMAL)`)
        );
        break;
      case 'rating':
        selectQuery = (selectQuery as any).orderBy(
          sortOrder === 'asc' ? asc(sql`CAST(${products.rating} AS DECIMAL)`) : desc(sql`CAST(${products.rating} AS DECIMAL)`)
        );
        break;
      case 'distance':
        if (latitude && longitude) {
          selectQuery = (selectQuery as any).orderBy(asc(sql`6371 * acos(cos(radians(${Number(latitude)})) * cos(radians(CAST(${users.latitude} AS DECIMAL))) * cos(radians(CAST(${users.longitude} AS DECIMAL)) - radians(${Number(longitude)})) + sin(radians(${Number(latitude)})) * sin(radians(CAST(${users.latitude} AS DECIMAL))))`));
        }
        break;
      case 'name':
        selectQuery = (selectQuery as any).orderBy(
          sortOrder === 'asc' ? asc(products.name) : desc(products.name)
        );
        break;
      default: // relevance or createdAt
        selectQuery = (selectQuery as any).orderBy(desc(products.createdAt));
    }

    const searchResults = await selectQuery.limit(Number(limit)).offset(offset);

    res.json({
      products: searchResults,
      filters: {
        query: q,
        category,
        priceRange: { min: minPrice, max: maxPrice },
        rating,
        location: { latitude, longitude, radius },
        inStock,
        merchantId
      },
      sorting: { sortBy, sortOrder },
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: searchResults.length
      }
    });
  } catch (error) {
    console.error('Advanced search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search merchants/vendors nearby
router.get('/merchants', async (req, res) => {
  try {
    const {
      q = '',
      latitude,
      longitude,
      radius = 10,
      businessType,
      rating,
      isVerified,
      page = 1,
      limit = 20,
      sortBy = 'distance'
    } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required for merchant search' });
    }

    const offset = (Number(page) - 1) * Number(limit);
    let whereConditions = [
      eq(users.role, 'MERCHANT'),
      eq(users.isActive, true)
    ];

    // Text search
    if (q) {
      whereConditions.push(
        sql`(${users.fullName} ILIKE ${`%${q}%`} OR ${merchantProfiles.businessName} ILIKE ${`%${q}%`})`
      );
    }

    // Business type filter
    if (businessType) {
      whereConditions.push(eq(merchantProfiles.businessType, businessType as any));
    }

    // Rating filter
    if (rating) {
      whereConditions.push(sql`CAST(${merchantProfiles.rating} AS DECIMAL) >= ${Number(rating)}`);
    }

    // Verification filter
    if (isVerified !== undefined) {
      whereConditions.push(eq(merchantProfiles.isVerified, isVerified === 'true'));
    }

    let merchantQuery = db.select({
      id: users.id,
      userId: users.userId,
      fullName: users.fullName,
      profilePicture: users.profilePicture,
      city: users.city,
      state: users.state,
      latitude: users.latitude,
      longitude: users.longitude,
      businessName: merchantProfiles.businessName,
      businessType: merchantProfiles.businessType,
      businessAddress: merchantProfiles.businessAddress,
      businessDescription: merchantProfiles.businessDescription,
      businessHours: merchantProfiles.businessHours,
      rating: merchantProfiles.rating,
      reviewCount: merchantProfiles.reviewCount,
      isVerified: merchantProfiles.isVerified,
      distance: sql<number>`6371 * acos(cos(radians(${Number(latitude)})) * cos(radians(CAST(${users.latitude} AS DECIMAL))) * cos(radians(CAST(${users.longitude} AS DECIMAL)) - radians(${Number(longitude)})) + sin(radians(${Number(latitude)})) * sin(radians(CAST(${users.latitude} AS DECIMAL))))`
    })
      .from(users)
      .innerJoin(merchantProfiles, eq(users.id, merchantProfiles.userId))
      .where(and(...whereConditions))
      .having(
        sql`6371 * acos(cos(radians(${Number(latitude)})) * cos(radians(CAST(${users.latitude} AS DECIMAL))) * cos(radians(CAST(${users.longitude} AS DECIMAL)) - radians(${Number(longitude)})) + sin(radians(${Number(latitude)})) * sin(radians(CAST(${users.latitude} AS DECIMAL)))) <= ${Number(radius)}`
      ) as any;

    // Sorting
    switch (sortBy) {
      case 'rating':
        merchantQuery = (merchantQuery as any).orderBy(desc(sql`CAST(${merchantProfiles.rating} AS DECIMAL)`));
        break;
      case 'name':
        merchantQuery = (merchantQuery as any).orderBy(asc(merchantProfiles.businessName));
        break;
      default: // distance
        merchantQuery = (merchantQuery as any).orderBy(asc(sql`6371 * acos(cos(radians(${Number(latitude)})) * cos(radians(CAST(${users.latitude} AS DECIMAL))) * cos(radians(CAST(${users.longitude} AS DECIMAL)) - radians(${Number(longitude)})) + sin(radians(${Number(latitude)})) * sin(radians(CAST(${users.latitude} AS DECIMAL))))`));
    }

    const nearbyMerchants = await merchantQuery.limit(Number(limit)).offset(offset);

    res.json({
      merchants: nearbyMerchants,
      filters: {
        query: q,
        location: { latitude, longitude, radius },
        businessType,
        rating,
        isVerified
      },
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: nearbyMerchants.length
      }
    });
  } catch (error) {
    console.error('Merchant search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get suggestions/autocomplete
router.get('/suggestions', async (req, res) => {
  try {
    const { q, type = 'all' } = req.query;

    if (!q || (q as string).length < 2) {
      return res.json({ suggestions: [] });
    }

    const suggestions: any[] = [];

    // Product suggestions
    if (type === 'all' || type === 'products') {
      const productSuggestions = await db.select({
        id: products.id,
        name: products.name,
        type: sql<string>`'product'`,
        image: products.image,
        price: products.price
      })
        .from(products)
        .where(and(
          eq(products.isActive, true),
          like(products.name, `%${q}%`)
        ))
        .limit(5);

      suggestions.push(...productSuggestions);
    }

    // Category suggestions
    if (type === 'all' || type === 'categories') {
      const categorySuggestions = await db.select({
        id: categories.id,
        name: categories.name,
        type: sql<string>`'category'`,
        icon: categories.icon
      })
        .from(categories)
        .where(and(
          eq(categories.isActive, true),
          like(categories.name, `%${q}%`)
        ))
        .limit(3);

      suggestions.push(...categorySuggestions);
    }

    // Merchant suggestions
    if (type === 'all' || type === 'merchants') {
      const merchantSuggestions = await db.select({
        id: users.id,
        name: merchantProfiles.businessName,
        type: sql<string>`'merchant'`,
        image: users.profilePicture,
        rating: merchantProfiles.rating
      })
        .from(users)
        .innerJoin(merchantProfiles, eq(users.id, merchantProfiles.userId))
        .where(and(
          eq(users.role, 'MERCHANT'),
          eq(users.isActive, true),
          like(merchantProfiles.businessName, `%${q}%`)
        ))
        .limit(3);

      suggestions.push(...merchantSuggestions);
    }

    res.json({ suggestions });
  } catch (error) {
    console.error('Search suggestions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Popular/trending searches
router.get('/trending', async (req, res) => {
  try {
    // This would typically come from analytics/search logs
    // For now, we'll return popular categories and products
    const popularCategories = await db.select({
      id: categories.id,
      name: categories.name,
      icon: categories.icon,
      productCount: sql<number>`(SELECT COUNT(*) FROM ${products} WHERE ${products.categoryId} = ${categories.id} AND ${products.isActive} = true)`
    })
      .from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(desc(sql`(SELECT COUNT(*) FROM ${products} WHERE ${products.categoryId} = ${categories.id} AND ${products.isActive} = true)`))
      .limit(5);

    const popularProducts = await db.select({
      id: products.id,
      name: products.name,
      image: products.image,
      price: products.price,
      rating: products.rating,
      reviewCount: products.reviewCount
    })
      .from(products)
      .where(eq(products.isActive, true))
      .orderBy(desc(sql`CAST(${products.rating} AS DECIMAL) * ${products.reviewCount}`))
      .limit(10);

    res.json({
      trending: {
        categories: popularCategories,
        products: popularProducts
      }
    });
  } catch (error) {
    console.error('Trending search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
