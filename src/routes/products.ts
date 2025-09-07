import { Router } from 'express';
import { eq, and, like, desc, sql } from 'drizzle-orm';
import db from '../config/database';
import { products, categories, users } from '../schema';
import { authenticateToken, authorizeRoles } from '../utils/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Get all categories
router.get('/categories', async (req, res) => {
  try {
    const allCategories = await db.select().from(categories).where(eq(categories.isActive, true));
    res.json(allCategories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create category (Admin only - for now any merchant can create)
router.post('/categories', authenticateToken, authorizeRoles('MERCHANT'), async (req, res) => {
  try {
    const { name, icon, slug, description } = req.body;

    if (!name || !icon || !slug) {
      return res.status(400).json({ error: 'Name, icon, and slug are required' });
    }

    // Check if slug already exists
    const existingCategory = await db.select().from(categories).where(eq(categories.slug, slug));
    if (existingCategory.length > 0) {
      return res.status(400).json({ error: 'Category with this slug already exists' });
    }

    const category = await db.insert(categories).values({
      name,
      icon,
      slug,
      description,
    }).returning();

    res.status(201).json({
      message: 'Category created successfully',
      category: category[0],
    });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all products with filters
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      categoryId, 
      sellerId,
      minPrice,
      maxPrice,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    let whereConditions = [eq(products.isActive, true)];

    if (search) {
      whereConditions.push(like(products.name, `%${search}%`));
    }

    if (categoryId) {
      whereConditions.push(eq(products.categoryId, Number(categoryId)));
    }

    if (sellerId) {
      whereConditions.push(eq(products.sellerId, Number(sellerId)));
    }

    if (minPrice) {
      whereConditions.push(sql`${products.price} >= ${Number(minPrice)}`);
    }

    if (maxPrice) {
      whereConditions.push(sql`${products.price} <= ${Number(maxPrice)}`);
    }

    const allProducts = await db.select({
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
    })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(users, eq(products.sellerId, users.id))
      .where(and(...whereConditions))
      .orderBy(sortOrder === 'desc' ? desc(products[sortBy as keyof typeof products]) : products[sortBy as keyof typeof products])
      .limit(Number(limit))
      .offset(offset);

    res.json({
      products: allProducts,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: allProducts.length,
      },
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single product
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const product = await db.select({
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
      seller: {
        id: users.id,
        userId: users.userId,
        fullName: users.fullName,
        profilePicture: users.profilePicture,
        city: users.city,
        state: users.state,
        phone: users.phone,
        email: users.email,
      },
    })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(users, eq(products.sellerId, users.id))
      .where(and(eq(products.id, id), eq(products.isActive, true)));

    if (product.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product[0]);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create product (Merchants only)
router.post('/', authenticateToken, authorizeRoles('MERCHANT'), async (req, res) => {
  try {
    const sellerId = (req as any).user.userId;
    const { name, description, price, unit, categoryId, image, minimumOrder } = req.body;

    if (!name || !description || !price || !unit || !categoryId) {
      return res.status(400).json({ error: 'Name, description, price, unit, and categoryId are required' });
    }

    // Verify category exists
    const category = await db.select().from(categories).where(eq(categories.id, categoryId));
    if (category.length === 0) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const product = await db.insert(products).values({
      name,
      description,
      price: price.toString(),
      unit,
      categoryId,
      sellerId,
      image,
      minimumOrder: minimumOrder || 1,
    }).returning();

    res.status(201).json({
      message: 'Product created successfully',
      product: product[0],
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update product (Product owner only)
router.put('/:id', authenticateToken, authorizeRoles('MERCHANT'), async (req, res) => {
  try {
    const { id } = req.params;
    const sellerId = (req as any).user.userId;
    const { name, description, price, unit, categoryId, image, minimumOrder, inStock } = req.body;

    // Check if product exists and belongs to the seller
    const existingProduct = await db.select().from(products).where(and(
      eq(products.id, id),
      eq(products.sellerId, sellerId)
    ));

    if (existingProduct.length === 0) {
      return res.status(404).json({ error: 'Product not found or you do not have permission to edit it' });
    }

    // Update product
    const updatedProduct = await db.update(products)
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
      message: 'Product updated successfully',
      product: updatedProduct[0],
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete product (Product owner only)
router.delete('/:id', authenticateToken, authorizeRoles('MERCHANT'), async (req, res) => {
  try {
    const { id } = req.params;
    const sellerId = (req as any).user.userId;

    // Check if product exists and belongs to the seller
    const existingProduct = await db.select().from(products).where(and(
      eq(products.id, id),
      eq(products.sellerId, sellerId)
    ));

    if (existingProduct.length === 0) {
      return res.status(404).json({ error: 'Product not found or you do not have permission to delete it' });
    }

    // Soft delete - mark as inactive
    await db.update(products)
      .set({ isActive: false })
      .where(eq(products.id, id));

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get products by seller
router.get('/seller/:sellerId', async (req, res) => {
  try {
    const { sellerId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const sellerProducts = await db.select({
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
        eq(products.sellerId, Number(sellerId)),
        eq(products.isActive, true)
      ))
      .orderBy(desc(products.createdAt))
      .limit(Number(limit))
      .offset(offset);

    res.json({
      products: sellerProducts,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: sellerProducts.length,
      },
    });
  } catch (error) {
    console.error('Get seller products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;