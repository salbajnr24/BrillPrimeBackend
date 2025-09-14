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
const validation_1 = require("../utils/validation");
const router = (0, express_1.Router)();
// Get subcategories/commodities with search
router.get('/subcategories', async (req, res) => {
    try {
        const { search } = req.query;
        let whereConditions = [(0, drizzle_orm_1.eq)(schema_1.products.isActive, true)];
        if (search) {
            whereConditions.push((0, drizzle_orm_1.like)(schema_1.products.name, `%${search}%`));
        }
        const commodities = await database_1.default.select({
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
            vendor: {
                id: schema_1.users.id,
                userId: schema_1.users.userId,
                fullName: schema_1.users.fullName,
                email: schema_1.users.email,
                profilePicture: schema_1.users.profilePicture,
                phone: schema_1.users.phone,
                city: schema_1.users.city,
                state: schema_1.users.state,
            },
        })
            .from(schema_1.products)
            .leftJoin(schema_1.categories, (0, drizzle_orm_1.eq)(schema_1.products.categoryId, schema_1.categories.id))
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.products.sellerId, schema_1.users.id))
            .where((0, drizzle_orm_1.and)(...whereConditions))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.products.createdAt));
        res.json({
            status: 'Success',
            message: 'Categories fetched successfully',
            data: commodities,
        });
    }
    catch (error) {
        console.error('Get subcategories error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Add commodity (Vendor/Merchant only)
router.post('/add', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('MERCHANT'), async (req, res) => {
    try {
        const vendorId = req.user.userId;
        const { name, description, price, unit, categoryId, image, minimumOrder, quantity, imageUrl } = req.body;
        // Validate the request data
        const validation = (0, validation_1.validateAddCommodity)({
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
        const category = await database_1.default.select().from(schema_1.categories).where((0, drizzle_orm_1.eq)(schema_1.categories.id, categoryId));
        if (category.length === 0) {
            return res.status(400).json({ error: 'Invalid category' });
        }
        const commodity = await database_1.default.insert(schema_1.products).values({
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
    }
    catch (error) {
        console.error('Add commodity error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Update commodity (Vendor only)
router.post('/update/:id', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('MERCHANT'), async (req, res) => {
    try {
        const { id } = req.params;
        const vendorId = req.user.userId;
        const { name, description, price, unit, categoryId, image, minimumOrder, inStock, quantity, imageUrl } = req.body;
        // Validate the request data
        const validation = (0, validation_1.validateUpdateCommodity)({
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
        const existingCommodity = await database_1.default.select().from(schema_1.products).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.products.id, id), (0, drizzle_orm_1.eq)(schema_1.products.sellerId, vendorId)));
        if (existingCommodity.length === 0) {
            return res.status(404).json({ error: 'Commodity not found or you do not have permission to edit it' });
        }
        // Update commodity
        const updatedCommodity = await database_1.default.update(schema_1.products)
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
            status: 'Success',
            message: 'Commodity updated successfully',
            data: updatedCommodity[0],
        });
    }
    catch (error) {
        console.error('Update commodity error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Remove commodity (Vendor only)
router.delete('/remove/:id', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('MERCHANT'), async (req, res) => {
    try {
        const { id } = req.params;
        const vendorId = req.user.userId;
        // Check if commodity exists and belongs to the vendor
        const existingCommodity = await database_1.default.select().from(schema_1.products).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.products.id, id), (0, drizzle_orm_1.eq)(schema_1.products.sellerId, vendorId)));
        if (existingCommodity.length === 0) {
            return res.status(404).json({ error: 'Commodity not found or you do not have permission to delete it' });
        }
        // Soft delete - mark as inactive
        await database_1.default.update(schema_1.products)
            .set({ isActive: false })
            .where((0, drizzle_orm_1.eq)(schema_1.products.id, id));
        res.json({
            status: 'Success',
            message: 'Commodity removed successfully',
        });
    }
    catch (error) {
        console.error('Remove commodity error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get all commodities
router.get('/all', auth_1.authenticateToken, async (req, res) => {
    try {
        const commodities = await database_1.default.select({
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
            vendor: {
                id: schema_1.users.id,
                userId: schema_1.users.userId,
                fullName: schema_1.users.fullName,
                email: schema_1.users.email,
                profilePicture: schema_1.users.profilePicture,
                phone: schema_1.users.phone,
                city: schema_1.users.city,
                state: schema_1.users.state,
            },
        })
            .from(schema_1.products)
            .leftJoin(schema_1.categories, (0, drizzle_orm_1.eq)(schema_1.products.categoryId, schema_1.categories.id))
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.products.sellerId, schema_1.users.id))
            .where((0, drizzle_orm_1.eq)(schema_1.products.isActive, true))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.products.createdAt));
        res.json({
            status: 'Success',
            message: 'Commodities fetched successfully',
            data: commodities,
        });
    }
    catch (error) {
        console.error('Get all commodities error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get single commodity
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const commodity = await database_1.default.select({
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
            vendor: {
                id: schema_1.users.id,
                userId: schema_1.users.userId,
                fullName: schema_1.users.fullName,
                email: schema_1.users.email,
                profilePicture: schema_1.users.profilePicture,
                phone: schema_1.users.phone,
                city: schema_1.users.city,
                state: schema_1.users.state,
            },
        })
            .from(schema_1.products)
            .leftJoin(schema_1.categories, (0, drizzle_orm_1.eq)(schema_1.products.categoryId, schema_1.categories.id))
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.products.sellerId, schema_1.users.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.products.id, id), (0, drizzle_orm_1.eq)(schema_1.products.isActive, true)));
        if (commodity.length === 0) {
            return res.status(404).json({ error: 'Commodity not found' });
        }
        res.json({
            status: 'Success',
            message: 'Commodity fetched successfully',
            data: commodity[0],
        });
    }
    catch (error) {
        console.error('Get commodity error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get vendor commodities
router.get('/vendor/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        const vendorCommodities = await database_1.default.select({
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
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.products.sellerId, Number(id)), (0, drizzle_orm_1.eq)(schema_1.products.isActive, true)))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.products.createdAt))
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
    }
    catch (error) {
        console.error('Get vendor commodities error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
