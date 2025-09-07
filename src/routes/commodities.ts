
import { Router } from 'express';
import { eq, and, like, desc, sql } from 'drizzle-orm';
import db from '../config/database';
import { products, categories, users } from '../schema';
import { authenticateToken, authorizeRoles } from '../utils/auth';
import { validateAddCommodity, validateUpdateCommodity } from '../utils/validation';
import { AddCommodityDto, UpdateCommodityDto } from '../types';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Get subcategories/commodities with search
router.get('/subcategories', async (req, res) => {
  try {
    const { search } = req.query;

    let whereConditions = [eq(products.isActive, true)];

    if (search) {
      whereConditions.push(like(products.name, `%${search}%`));
    }

    const commodities = await db.select({
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
      vendor: {
        id: users.id,
        userId: users.userId,
        fullName: users.fullName,
        email: users.email,
        profilePicture: users.profilePicture,
        phone: users.phone,
        city: users.city,
        state: users.state,
      },
    })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(users, eq(products.sellerId, users.id))
      .where(and(...whereConditions))
      .orderBy(desc(products.createdAt));

    res.json({
      status: 'Success',
      message: 'Categories fetched successfully',
      data: commodities,
    });
  } catch (error) {
    console.error('Get subcategories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add commodity (Vendor/Merchant only)
router.post('/add', authenticateToken, authorizeRoles('MERCHANT'), async (req, res) => {
  try {
    const vendorId = (req as any).user.userId;
    const { name, description, price, unit, categoryId, image, minimumOrder, quantity, imageUrl } = req.body;

    // Validate the request data
    const validation = validateAddCommodity({ 
      name, 
      description, 
      price, 
      unit, 
      quantity: quantity || 1,
      imageUrl: image || imageUrl 
    });
    
    if (!validation.isValid) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.errors 
      });
    }

    if (!categoryId) {
      return res.status(400).json({ error: 'CategoryId is required' });
    }

    // Verify category exists
    const category = await db.select().from(categories).where(eq(categories.id, categoryId));
    if (category.length === 0) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const commodity = await db.insert(products).values({
      name,
      description,
      price: price.toString(),
      unit,
      categoryId,
      sellerId: vendorId,
      image,
      minimumOrder: minimumOrder || 1,
    }).returning();

    res.status(201).json({
      status: 'Success',
      message: 'Commodity added successfully',
      data: commodity[0],
    });
  } catch (error) {
    console.error('Add commodity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update commodity (Vendor only)
router.post('/update/:id', authenticateToken, authorizeRoles('MERCHANT'), async (req, res) => {
  try {
    const { id } = req.params;
    const vendorId = (req as any).user.userId;
    const { name, description, price, unit, categoryId, image, minimumOrder, inStock, quantity, imageUrl } = req.body;

    // Validate the request data
    const validation = validateUpdateCommodity({ 
      name, 
      description, 
      price, 
      unit, 
      quantity,
      imageUrl: image || imageUrl 
    });
    
    if (!validation.isValid) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.errors 
      });
    }

    // Check if commodity exists and belongs to the vendor
    const existingCommodity = await db.select().from(products).where(and(
      eq(products.id, id),
      eq(products.sellerId, vendorId)
    ));

    if (existingCommodity.length === 0) {
      return res.status(404).json({ error: 'Commodity not found or you do not have permission to edit it' });
    }

    // Update commodity
    const updatedCommodity = await db.update(products)
      .set({
        name,
        description,
        price: price?.toString(),
        unit,
        categoryId,
        image,
        minimumOrder,
        inStock,
        updatedAt: new Date(),
      })
      .where(eq(products.id, id))
      .returning();

    res.json({
      status: 'Success',
      message: 'Commodity updated successfully',
      data: updatedCommodity[0],
    });
  } catch (error) {
    console.error('Update commodity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove commodity (Vendor only)
router.delete('/remove/:id', authenticateToken, authorizeRoles('MERCHANT'), async (req, res) => {
  try {
    const { id } = req.params;
    const vendorId = (req as any).user.userId;

    // Check if commodity exists and belongs to the vendor
    const existingCommodity = await db.select().from(products).where(and(
      eq(products.id, id),
      eq(products.sellerId, vendorId)
    ));

    if (existingCommodity.length === 0) {
      return res.status(404).json({ error: 'Commodity not found or you do not have permission to delete it' });
    }

    // Soft delete - mark as inactive
    await db.update(products)
      .set({ isActive: false })
      .where(eq(products.id, id));

    res.json({
      status: 'Success',
      message: 'Commodity removed successfully',
    });
  } catch (error) {
    console.error('Remove commodity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all commodities
router.get('/all', authenticateToken, async (req, res) => {
  try {
    const commodities = await db.select({
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
      vendor: {
        id: users.id,
        userId: users.userId,
        fullName: users.fullName,
        email: users.email,
        profilePicture: users.profilePicture,
        phone: users.phone,
        city: users.city,
        state: users.state,
      },
    })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(users, eq(products.sellerId, users.id))
      .where(eq(products.isActive, true))
      .orderBy(desc(products.createdAt));

    res.json({
      status: 'Success',
      message: 'Commodities fetched successfully',
      data: commodities,
    });
  } catch (error) {
    console.error('Get all commodities error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single commodity
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const commodity = await db.select({
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
      updatedAt: products.updatedAt,
      category: {
        id: categories.id,
        name: categories.name,
        icon: categories.icon,
        slug: categories.slug,
      },
      vendor: {
        id: users.id,
        userId: users.userId,
        fullName: users.fullName,
        email: users.email,
        profilePicture: users.profilePicture,
        phone: users.phone,
        city: users.city,
        state: users.state,
      },
    })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(users, eq(products.sellerId, users.id))
      .where(and(eq(products.id, id), eq(products.isActive, true)));

    if (commodity.length === 0) {
      return res.status(404).json({ error: 'Commodity not found' });
    }

    res.json({
      status: 'Success',
      message: 'Commodity fetched successfully',
      data: commodity[0],
    });
  } catch (error) {
    console.error('Get commodity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get vendor commodities
router.get('/vendor/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const vendorCommodities = await db.select({
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
    })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(and(
        eq(products.sellerId, Number(id)),
        eq(products.isActive, true)
      ))
      .orderBy(desc(products.createdAt))
      .limit(Number(limit))
      .offset(offset);

    res.json({
      status: 'Success',
      message: 'Vendor commodities fetched successfully',
      data: vendorCommodities,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: vendorCommodities.length,
      },
    });
  } catch (error) {
    console.error('Get vendor commodities error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
