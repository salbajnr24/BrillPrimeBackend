"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const database_1 = __importDefault(require("../config/database"));
const schema_1 = require("../schema");
const auth_1 = require("../utils/auth");
const router = (0, express_1.Router)();
// Get all categories
router.get('/categories', async (req, res) => {
    try {
        const allCategories = await database_1.default.select().from(schema_1.categories).where((0, drizzle_orm_1.eq)(schema_1.categories.isActive, true));
        res.json(allCategories);
    }
    catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Create category (Admin only - for now any merchant can create)
router.post('/categories', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('MERCHANT'), async (req, res) => {
    try {
        const { name, icon, slug, description } = req.body;
        if (!name || !icon || !slug) {
            return res.status(400).json({ error: 'Name, icon, and slug are required' });
        }
        // Check if slug already exists
        const existingCategory = await database_1.default.select().from(schema_1.categories).where((0, drizzle_orm_1.eq)(schema_1.categories.slug, slug));
        if (existingCategory.length > 0) {
            return res.status(400).json({ error: 'Category with this slug already exists' });
        }
        const category = await database_1.default.insert(schema_1.categories).values({
            name,
            icon,
            slug,
            description,
        }).returning();
        res.status(201).json({
            message: 'Category created successfully',
            category: category[0],
        });
    }
    catch (error) {
        console.error('Create category error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get all products with filters
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', categoryId, sellerId, minPrice, maxPrice, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        let whereConditions = [(0, drizzle_orm_1.eq)(schema_1.products.isActive, true)];
        if (search) {
            whereConditions.push((0, drizzle_orm_1.like)(schema_1.products.name, `%${search}%`));
        }
        if (categoryId) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.products.categoryId, Number(categoryId)));
        }
        if (sellerId) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.products.sellerId, Number(sellerId)));
        }
        if (minPrice) {
            whereConditions.push((0, drizzle_orm_1.sql) `${schema_1.products.price} >= ${Number(minPrice)}`);
        }
        if (maxPrice) {
            whereConditions.push((0, drizzle_orm_1.sql) `${schema_1.products.price} <= ${Number(maxPrice)}`);
        }
        const allProducts = await database_1.default.select({
            id: schema_1.products.id,
            name: schema_1.products.name,
            description: schema_1.products.description,
            price: schema_1.products.price,
            unit: schema_1.products.unit,
            image: schema_1.products.image,
            rating: schema_1.products.rating,
            reviewCount: schema_1.products.reviewCount,
            inStock: schema_1.products.inStock,
            minimumOrder: schema_1.products.minimumOrder,
            createdAt: schema_1.products.createdAt,
            category: {
                id: schema_1.categories.id,
                name: schema_1.categories.name,
                icon: schema_1.categories.icon,
                slug: schema_1.categories.slug,
            },
            seller: {
                id: schema_1.users.id,
                userId: schema_1.users.userId,
                fullName: schema_1.users.fullName,
                profilePicture: schema_1.users.profilePicture,
                city: schema_1.users.city,
                state: schema_1.users.state,
            },
        })
            .from(schema_1.products)
            .leftJoin(schema_1.categories, (0, drizzle_orm_1.eq)(schema_1.products.categoryId, schema_1.categories.id))
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.products.sellerId, schema_1.users.id))
            .where((0, drizzle_orm_1.and)(...whereConditions))
            .orderBy(sortOrder === 'desc' ? (0, drizzle_orm_1.desc)(schema_1.products.createdAt) : schema_1.products.createdAt)
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
    }
    catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get single product
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const product = await database_1.default.select({
            id: schema_1.products.id,
            name: schema_1.products.name,
            description: schema_1.products.description,
            price: schema_1.products.price,
            unit: schema_1.products.unit,
            image: schema_1.products.image,
            rating: schema_1.products.rating,
            reviewCount: schema_1.products.reviewCount,
            inStock: schema_1.products.inStock,
            minimumOrder: schema_1.products.minimumOrder,
            createdAt: schema_1.products.createdAt,
            updatedAt: schema_1.products.updatedAt,
            category: {
                id: schema_1.categories.id,
                name: schema_1.categories.name,
                icon: schema_1.categories.icon,
                slug: schema_1.categories.slug,
            },
            seller: {
                id: schema_1.users.id,
                userId: schema_1.users.userId,
                fullName: schema_1.users.fullName,
                profilePicture: schema_1.users.profilePicture,
                city: schema_1.users.city,
                state: schema_1.users.state,
                phone: schema_1.users.phone,
                email: schema_1.users.email,
            },
        })
            .from(schema_1.products)
            .leftJoin(schema_1.categories, (0, drizzle_orm_1.eq)(schema_1.products.categoryId, schema_1.categories.id))
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.products.sellerId, schema_1.users.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.products.id, id), (0, drizzle_orm_1.eq)(schema_1.products.isActive, true)));
        if (product.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json(product[0]);
    }
    catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Create product (Merchants only)
router.post('/', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('MERCHANT'), async (req, res) => {
    try {
        const sellerId = req.user.userId;
        const { name, description, price, unit, categoryId, image, minimumOrder } = req.body;
        if (!name || !description || !price || !unit || !categoryId) {
            return res.status(400).json({ error: 'Name, description, price, unit, and categoryId are required' });
        }
        // Verify category exists
        const category = await database_1.default.select().from(schema_1.categories).where((0, drizzle_orm_1.eq)(schema_1.categories.id, categoryId));
        if (category.length === 0) {
            return res.status(400).json({ error: 'Invalid category' });
        }
        const product = await database_1.default.insert(schema_1.products).values({
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
    }
    catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Update product (Product owner only)
router.put('/:id', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('MERCHANT'), async (req, res) => {
    try {
        const { id } = req.params;
        const sellerId = req.user.userId;
        const { name, description, price, unit, categoryId, image, minimumOrder, inStock } = req.body;
        // Check if product exists and belongs to the seller
        const existingProduct = await database_1.default.select().from(schema_1.products).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.products.id, id), (0, drizzle_orm_1.eq)(schema_1.products.sellerId, sellerId)));
        if (existingProduct.length === 0) {
            return res.status(404).json({ error: 'Product not found or you do not have permission to edit it' });
        }
        // Update product
        const updatedProduct = await database_1.default.update(schema_1.products)
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
            .where((0, drizzle_orm_1.eq)(schema_1.products.id, id))
            .returning();
        res.json({
            message: 'Product updated successfully',
            product: updatedProduct[0],
        });
    }
    catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Delete product (Product owner only)
router.delete('/:id', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('MERCHANT'), async (req, res) => {
    try {
        const { id } = req.params;
        const sellerId = req.user.userId;
        // Check if product exists and belongs to the seller
        const existingProduct = await database_1.default.select().from(schema_1.products).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.products.id, id), (0, drizzle_orm_1.eq)(schema_1.products.sellerId, sellerId)));
        if (existingProduct.length === 0) {
            return res.status(404).json({ error: 'Product not found or you do not have permission to delete it' });
        }
        // Soft delete - mark as inactive
        await database_1.default.update(schema_1.products)
            .set({ isActive: false })
            .where((0, drizzle_orm_1.eq)(schema_1.products.id, id));
        res.json({ message: 'Product deleted successfully' });
    }
    catch (error) {
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
        const sellerProducts = await database_1.default.select({
            id: schema_1.products.id,
            name: schema_1.products.name,
            description: schema_1.products.description,
            price: schema_1.products.price,
            unit: schema_1.products.unit,
            image: schema_1.products.image,
            rating: schema_1.products.rating,
            reviewCount: schema_1.products.reviewCount,
            inStock: schema_1.products.inStock,
            minimumOrder: schema_1.products.minimumOrder,
            createdAt: schema_1.products.createdAt,
            category: {
                id: schema_1.categories.id,
                name: schema_1.categories.name,
                icon: schema_1.categories.icon,
            },
        })
            .from(schema_1.products)
            .leftJoin(schema_1.categories, (0, drizzle_orm_1.eq)(schema_1.products.categoryId, schema_1.categories.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.products.sellerId, Number(sellerId)), (0, drizzle_orm_1.eq)(schema_1.products.isActive, true)))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.products.createdAt))
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
    }
    catch (error) {
        console.error('Get seller products error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=products.js.map