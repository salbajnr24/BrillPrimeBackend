import { Router } from 'express';
import { eq, and, like, sql, desc, asc, count, or } from 'drizzle-orm';
import db from '../config/database';
import { products, categories, users, merchantProfiles, searchHistory, trendingSearches } from '../schema';
import { authenticateToken } from '../utils/auth';
import { Message } from '../utils/messages';

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

// Get autocomplete suggestions
router.get('/autocomplete', async (req, res) => {
  try {
    const { q: query, limit = 10 } = req.query;

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return res.status(400).json({
        error: 'Query parameter "q" is required and must be at least 2 characters'
      });
    }

    const searchTerm = `%${query.trim()}%`;

    // Get product suggestions
    const productSuggestions = await db.select({
      id: products.id,
      name: products.name,
      type: sql`'product'`.as('type'),
      image: products.image,
      price: products.price,
    })
      .from(products)
      .where(and(
        eq(products.isActive, true),
        like(products.name, searchTerm)
      ))
      .limit(Number(limit) / 2);

    // Get category suggestions
    const categorySuggestions = await db.select({
      id: categories.id,
      name: categories.name,
      type: sql`'category'`.as('type'),
      image: categories.icon,
      price: sql`null`.as('price'),
    })
      .from(categories)
      .where(like(categories.name, searchTerm))
      .limit(Number(limit) / 2);

    const suggestions = [...productSuggestions, ...categorySuggestions]
      .slice(0, Number(limit));

    res.json({
      status: 'Success',
      message: Message.searchAutocomplete,
      data: {
        suggestions,
        query: query.trim(),
        total: suggestions.length,
      },
    });
  } catch (error) {
    console.error('Autocomplete search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/search/suggestions - Get suggestions/autocomplete
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


// POST /api/search/advanced - Advanced search with filters
router.post('/advanced', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const {
      query,
      category,
      minPrice,
      maxPrice,
      location,
      rating,
      inStock,
      sortBy = 'relevance',
      page = 1,
      limit = 20
    } = req.body;

    const offset = (Number(page) - 1) * Number(limit);

    let whereConditions: any[] = [eq(products.isActive, true)];

    // Text search
    if (query) {
      whereConditions.push(
        or(
          like(products.name, `%${query}%`),
          like(products.description, `%${query}%`)
        )
      );
    }

    // Category filter
    if (category) {
      whereConditions.push(eq(products.categoryId, category));
    }

    // Price range filter
    if (minPrice) {
      whereConditions.push(sql`CAST(${products.price} AS DECIMAL) >= ${minPrice}`);
    }
    if (maxPrice) {
      whereConditions.push(sql`CAST(${products.price} AS DECIMAL) <= ${maxPrice}`);
    }

    // Stock filter
    if (inStock !== undefined) {
      whereConditions.push(eq(products.inStock, inStock));
    }

    // Rating filter
    if (rating) {
      whereConditions.push(sql`${products.rating} >= ${rating}`);
    }

    // Build the query
    let orderBy;
    switch (sortBy) {
      case 'price_low':
        orderBy = sql`CAST(${products.price} AS DECIMAL) ASC`;
        break;
      case 'price_high':
        orderBy = sql`CAST(${products.price} AS DECIMAL) DESC`;
        break;
      case 'rating':
        orderBy = desc(products.rating);
        break;
      case 'newest':
        orderBy = desc(products.createdAt);
        break;
      default:
        orderBy = desc(products.createdAt);
    }

    const results = await db.select({
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
      },
      seller: {
        id: users.id,
        fullName: users.fullName,
        profilePicture: users.profilePicture,
        city: users.city,
        state: users.state,
      },
    })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(users, eq(products.sellerId, users.id))
      .where(and(...whereConditions))
      .orderBy(orderBy)
      .limit(Number(limit))
      .offset(offset);

    // Save search history
    if (query) {
      try {
        await db.insert(searchHistory).values({
          userId,
          searchTerm: query,
          filters: JSON.stringify({ category, minPrice, maxPrice, location, rating, inStock }),
          resultsCount: results.length,
        });
      } catch (historyError) {
        console.error('Failed to save search history:', historyError);
      }
    }

    res.json({
      status: 'Success',
      message: Message.advancedSearch,
      data: {
        results,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: results.length,
        },
        filters: {
          query,
          category,
          minPrice,
          maxPrice,
          location,
          rating,
          inStock,
          sortBy,
        },
      },
    });
  } catch (error) {
    console.error('Advanced search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/search/trending - Trending searches and products
router.get('/trending', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    // Get trending search terms from the last 7 days
    const trendingSearchTerms = await db.select({
      searchTerm: searchHistory.searchTerm,
      searchCount: count(searchHistory.id),
    })
      .from(searchHistory)
      .where(sql`${searchHistory.createdAt} >= NOW() - INTERVAL '7 days'`)
      .groupBy(searchHistory.searchTerm)
      .orderBy(desc(count(searchHistory.id)))
      .limit(Number(limit));

    // Get trending products (most viewed/ordered)
    const trendingProducts = await db.select({
      id: products.id,
      name: products.name,
      price: products.price,
      image: products.image,
      rating: products.rating,
      reviewCount: products.reviewCount,
      category: {
        name: categories.name,
      },
      seller: {
        name: users.fullName,
      },
    })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(users, eq(products.sellerId, users.id))
      .where(eq(products.isActive, true))
      .orderBy(desc(products.reviewCount))
      .limit(Number(limit));

    res.json({
      status: 'Success',
      message: Message.trendingSearch,
      data: {
        trendingSearches: trendingSearchTerms,
        trendingProducts,
        generatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Trending search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/search/save-search - Save search criteria
router.post('/save-search', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { name, searchTerm, filters } = req.body;

    if (!name || !searchTerm) {
      return res.status(400).json({ error: 'Search name and search term are required' });
    }

    const savedSearch = await db.insert(searchHistory).values({
      userId,
      searchTerm,
      filters: JSON.stringify(filters || {}),
      isSaved: true,
      savedName: name,
    }).returning();

    res.status(201).json({
      status: 'Success',
      message: Message.saveSearch,
      data: savedSearch[0],
    });
  } catch (error) {
    console.error('Save search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/search/saved - Get user's saved searches
router.get('/saved', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    const savedSearches = await db.select({
      id: searchHistory.id,
      name: searchHistory.savedName,
      searchTerm: searchHistory.searchTerm,
      filters: searchHistory.filters,
      createdAt: searchHistory.createdAt,
    })
      .from(searchHistory)
      .where(and(
        eq(searchHistory.userId, userId),
        eq(searchHistory.isSaved, true)
      ))
      .orderBy(desc(searchHistory.createdAt));

    res.json({
      status: 'Success',
      message: 'Saved searches fetched successfully',
      data: savedSearches,
    });
  } catch (error) {
    console.error('Get saved searches error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/search/saved/:id - Delete saved search
router.delete('/saved/:id', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { id } = req.params;

    await db.delete(searchHistory)
      .where(and(
        eq(searchHistory.id, id),
        eq(searchHistory.userId, userId),
        eq(searchHistory.isSaved, true)
      ));

    res.json({
      status: 'Success',
      message: 'Saved search deleted successfully',
    });
  } catch (error) {
    console.error('Delete saved search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
<line_number>1</line_number>
import { Router } from 'express';
import { eq, and, like, sql, desc, asc, count, or } from 'drizzle-orm';
import db from '../config/database';
import { products, categories, users, merchantProfiles, searchHistory, trendingSearches } from '../schema';
import { authenticateToken } from '../utils/auth';
import { Message } from '../utils/messages';

const router = Router();

// Search merchants
router.get('/merchants', async (req, res) => {
  try {
    const { q = '', location, category, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereConditions = [eq(users.role, 'MERCHANT'), eq(users.isVerified, true)];

    if (q) {
      whereConditions.push(
        or(
          like(users.fullName, `%${q}%`),
          like(merchantProfiles.businessName, `%${q}%`),
          like(merchantProfiles.businessDescription, `%${q}%`)
        )
      );
    }

    if (location) {
      whereConditions.push(
        or(
          like(users.city, `%${location}%`),
          like(users.state, `%${location}%`),
          like(merchantProfiles.businessAddress, `%${location}%`)
        )
      );
    }

    if (category) {
      whereConditions.push(eq(merchantProfiles.businessType, category as string));
    }

    const merchants = await db.select({
      id: users.id,
      fullName: users.fullName,
      profilePicture: users.profilePicture,
      city: users.city,
      state: users.state,
      businessName: merchantProfiles.businessName,
      businessType: merchantProfiles.businessType,
      businessDescription: merchantProfiles.businessDescription,
      businessLogo: merchantProfiles.businessLogo,
      rating: merchantProfiles.rating,
      reviewCount: merchantProfiles.reviewCount,
      isVerified: merchantProfiles.isVerified,
    })
      .from(users)
      .leftJoin(merchantProfiles, eq(users.id, merchantProfiles.userId))
      .where(and(...whereConditions))
      .limit(Number(limit))
      .offset(offset);

    res.json({
      status: 'Success',
      message: 'Merchants found successfully',
      data: {
        merchants,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: merchants.length,
        },
      },
    });
  } catch (error) {
    console.error('Search merchants error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get trending searches
router.get('/trending', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const trending = await db.select()
      .from(trendingSearches)
      .orderBy(desc(trendingSearches.searchCount))
      .limit(Number(limit));

    res.json({
      status: 'Success',
      message: 'Trending searches retrieved successfully',
      data: trending,
    });
  } catch (error) {
    console.error('Get trending searches error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Save search query
router.post('/save', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // Save to search history
    await db.insert(searchHistory).values({
      userId,
      searchQuery: query,
      searchType: 'GENERAL',
    });

    // Update trending searches
    const existing = await db.select()
      .from(trendingSearches)
      .where(eq(trendingSearches.searchTerm, query));

    if (existing.length > 0) {
      await db.update(trendingSearches)
        .set({ searchCount: existing[0].searchCount + 1 })
        .where(eq(trendingSearches.id, existing[0].id));
    } else {
      await db.insert(trendingSearches).values({
        searchTerm: query,
        searchCount: 1,
      });
    }

    res.json({
      status: 'Success',
      message: 'Search query saved successfully',
    });
  } catch (error) {
    console.error('Save search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get search history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const history = await db.select()
      .from(searchHistory)
      .where(eq(searchHistory.userId, userId))
      .orderBy(desc(searchHistory.createdAt))
      .limit(Number(limit))
      .offset(offset);

    res.json({
      status: 'Success',
      message: 'Search history retrieved successfully',
      data: {
        history,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: history.length,
        },
      },
    });
  } catch (error) {
    console.error('Get search history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get search suggestions
router.get('/suggestions', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.json({
        status: 'Success',
        data: { suggestions: [] },
      });
    }

    // Get product suggestions
    const productSuggestions = await db.select({
      id: products.id,
      name: products.name,
      type: sql<string>`'product'`,
    })
      .from(products)
      .where(and(
        like(products.name, `%${q}%`),
        eq(products.isActive, true)
      ))
      .limit(5);

    // Get category suggestions
    const categorySuggestions = await db.select({
      id: categories.id,
      name: categories.name,
      type: sql<string>`'category'`,
    })
      .from(categories)
      .where(like(categories.name, `%${q}%`))
      .limit(3);

    const suggestions = [...productSuggestions, ...categorySuggestions];

    res.json({
      status: 'Success',
      message: 'Search suggestions retrieved successfully',
      data: { suggestions },
    });
  } catch (error) {
    console.error('Get search suggestions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Advanced product search (already exists but ensure it has all expected query params)
router.get('/products', async (req, res) => {
  try {
    const {
      q = '',
      category,
      minPrice,
      maxPrice,
      rating,
      location,
      latitude,
      longitude,
      radius = 10,
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
      },
      merchant: {
        businessName: merchantProfiles.businessName,
        businessAddress: merchantProfiles.businessAddress,
        rating: merchantProfiles.rating,
      },
    })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(users, eq(products.sellerId, users.id))
      .leftJoin(merchantProfiles, eq(users.id, merchantProfiles.userId))
      .where(and(...whereConditions));

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
      case 'newest':
        selectQuery = (selectQuery as any).orderBy(desc(products.createdAt));
        break;
      default:
        selectQuery = (selectQuery as any).orderBy(desc(products.createdAt));
    }

    const searchResults = await selectQuery
      .limit(Number(limit))
      .offset(offset);

    res.json({
      status: 'Success',
      message: 'Search completed successfully',
      data: {
        products: searchResults,
        searchQuery: q,
        filters: { category, minPrice, maxPrice, rating, inStock, merchantId },
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: searchResults.length,
        },
      },
    });
  } catch (error) {
    console.error('Product search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
