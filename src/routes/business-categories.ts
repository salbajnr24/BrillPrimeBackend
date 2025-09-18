
import { Router } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import db from '../config/database';
import { businessCategories, commodityCategories } from '../schema';
import { authenticateToken, authorizeRoles } from '../utils/auth';

const router = Router();

// Get all business categories
router.get('/', async (req, res) => {
  try {
    const categories = await db.select({
      id: businessCategories.id,
      name: businessCategories.name,
      imageUrl: businessCategories.imageUrl,
      createdAt: businessCategories.createdAt,
    })
      .from(businessCategories)
      .where(eq(businessCategories.isDeleted, false))
      .orderBy(businessCategories.name);

    res.json({
      status: 'Success',
      message: 'Business categories fetched successfully',
      data: categories,
    });
  } catch (error) {
    console.error('Get business categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get commodity categories by business category
router.get('/:businessCategoryId/commodities', async (req, res) => {
  try {
    const { businessCategoryId } = req.params;

    const commodities = await db.select({
      id: commodityCategories.id,
      name: commodityCategories.name,
      businessCategoryId: commodityCategories.businessCategoryId,
      createdAt: commodityCategories.createdAt,
    })
      .from(commodityCategories)
      .where(and(
        eq(commodityCategories.businessCategoryId, businessCategoryId),
        eq(commodityCategories.isDeleted, false)
      ))
      .orderBy(commodityCategories.name);

    res.json({
      status: 'Success',
      message: 'Commodity categories fetched successfully',
      data: commodities,
    });
  } catch (error) {
    console.error('Get commodity categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create business category (Admin only)
router.post('/', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { name, imageUrl } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const category = await db.insert(businessCategories).values({
      name,
      imageUrl,
    }).returning();

    res.status(201).json({
      status: 'Success',
      message: 'Business category created successfully',
      data: category[0],
    });
  } catch (error) {
    console.error('Create business category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create commodity category (Admin only)
router.post('/:businessCategoryId/commodities', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { businessCategoryId } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Commodity category name is required' });
    }

    const category = await db.insert(commodityCategories).values({
      name,
      businessCategoryId,
    }).returning();

    res.status(201).json({
      status: 'Success',
      message: 'Commodity category created successfully',
      data: category[0],
    });
  } catch (error) {
    console.error('Create commodity category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
