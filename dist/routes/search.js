"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const database_1 = __importDefault(require("../config/database"));
const schema_1 = require("../schema");
const router = (0, express_1.Router)();
// Advanced search with filters
router.get('/products', async (req, res) => {
    try {
        const { q = '', // search query
        category, minPrice, maxPrice, rating, location, latitude, longitude, radius = 10, // km
        sortBy = 'relevance', sortOrder = 'desc', page = 1, limit = 20, inStock, merchantId } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        let whereConditions = [(0, drizzle_orm_1.eq)(schema_1.products.isActive, true)];
        // Text search
        if (q) {
            whereConditions.push((0, drizzle_orm_1.sql) `(${schema_1.products.name} ILIKE ${`%${q}%`} OR ${schema_1.products.description} ILIKE ${`%${q}%`})`);
        }
        // Category filter
        if (category) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.products.categoryId, Number(category)));
        }
        // Price range filter
        if (minPrice) {
            whereConditions.push((0, drizzle_orm_1.sql) `CAST(${schema_1.products.price} AS DECIMAL) >= ${Number(minPrice)}`);
        }
        if (maxPrice) {
            whereConditions.push((0, drizzle_orm_1.sql) `CAST(${schema_1.products.price} AS DECIMAL) <= ${Number(maxPrice)}`);
        }
        // Rating filter
        if (rating) {
            whereConditions.push((0, drizzle_orm_1.sql) `CAST(${schema_1.products.rating} AS DECIMAL) >= ${Number(rating)}`);
        }
        // Stock filter
        if (inStock !== undefined) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.products.inStock, inStock === 'true'));
        }
        // Merchant filter
        if (merchantId) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.products.sellerId, Number(merchantId)));
        }
        let selectQuery = database_1.default.select({
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
                latitude: schema_1.users.latitude,
                longitude: schema_1.users.longitude,
            },
            merchant: {
                businessName: schema_1.merchantProfiles.businessName,
                businessAddress: schema_1.merchantProfiles.businessAddress,
                rating: schema_1.merchantProfiles.rating,
            },
            distance: latitude && longitude ?
                (0, drizzle_orm_1.sql) `6371 * acos(cos(radians(${Number(latitude)})) * cos(radians(CAST(${schema_1.users.latitude} AS DECIMAL))) * cos(radians(CAST(${schema_1.users.longitude} AS DECIMAL)) - radians(${Number(longitude)})) + sin(radians(${Number(latitude)})) * sin(radians(CAST(${schema_1.users.latitude} AS DECIMAL))))` :
                (0, drizzle_orm_1.sql) `0`
        })
            .from(schema_1.products)
            .leftJoin(schema_1.categories, (0, drizzle_orm_1.eq)(schema_1.products.categoryId, schema_1.categories.id))
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.products.sellerId, schema_1.users.id))
            .leftJoin(schema_1.merchantProfiles, (0, drizzle_orm_1.eq)(schema_1.users.id, schema_1.merchantProfiles.userId))
            .where((0, drizzle_orm_1.and)(...whereConditions));
        // Geo-location filter
        if (latitude && longitude && radius) {
            selectQuery = selectQuery.having((0, drizzle_orm_1.sql) `6371 * acos(cos(radians(${Number(latitude)})) * cos(radians(CAST(${schema_1.users.latitude} AS DECIMAL))) * cos(radians(CAST(${schema_1.users.longitude} AS DECIMAL)) - radians(${Number(longitude)})) + sin(radians(${Number(latitude)})) * sin(radians(CAST(${schema_1.users.latitude} AS DECIMAL)))) <= ${Number(radius)}`);
        }
        // Sorting
        switch (sortBy) {
            case 'price':
                selectQuery = selectQuery.orderBy(sortOrder === 'asc' ? (0, drizzle_orm_1.asc)((0, drizzle_orm_1.sql) `CAST(${schema_1.products.price} AS DECIMAL)`) : (0, drizzle_orm_1.desc)((0, drizzle_orm_1.sql) `CAST(${schema_1.products.price} AS DECIMAL)`));
                break;
            case 'rating':
                selectQuery = selectQuery.orderBy(sortOrder === 'asc' ? (0, drizzle_orm_1.asc)((0, drizzle_orm_1.sql) `CAST(${schema_1.products.rating} AS DECIMAL)`) : (0, drizzle_orm_1.desc)((0, drizzle_orm_1.sql) `CAST(${schema_1.products.rating} AS DECIMAL)`));
                break;
            case 'distance':
                if (latitude && longitude) {
                    selectQuery = selectQuery.orderBy((0, drizzle_orm_1.asc)((0, drizzle_orm_1.sql) `6371 * acos(cos(radians(${Number(latitude)})) * cos(radians(CAST(${schema_1.users.latitude} AS DECIMAL))) * cos(radians(CAST(${schema_1.users.longitude} AS DECIMAL)) - radians(${Number(longitude)})) + sin(radians(${Number(latitude)})) * sin(radians(CAST(${schema_1.users.latitude} AS DECIMAL))))`));
                }
                break;
            case 'name':
                selectQuery = selectQuery.orderBy(sortOrder === 'asc' ? (0, drizzle_orm_1.asc)(schema_1.products.name) : (0, drizzle_orm_1.desc)(schema_1.products.name));
                break;
            default: // relevance or createdAt
                selectQuery = selectQuery.orderBy((0, drizzle_orm_1.desc)(schema_1.products.createdAt));
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
    }
    catch (error) {
        console.error('Advanced search error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Search merchants/vendors nearby
router.get('/merchants', async (req, res) => {
    try {
        const { q = '', latitude, longitude, radius = 10, businessType, rating, isVerified, page = 1, limit = 20, sortBy = 'distance' } = req.query;
        if (!latitude || !longitude) {
            return res.status(400).json({ error: 'Latitude and longitude are required for merchant search' });
        }
        const offset = (Number(page) - 1) * Number(limit);
        let whereConditions = [
            (0, drizzle_orm_1.eq)(schema_1.users.role, 'MERCHANT'),
            (0, drizzle_orm_1.eq)(schema_1.users.isActive, true)
        ];
        // Text search
        if (q) {
            whereConditions.push((0, drizzle_orm_1.sql) `(${schema_1.users.fullName} ILIKE ${`%${q}%`} OR ${schema_1.merchantProfiles.businessName} ILIKE ${`%${q}%`})`);
        }
        // Business type filter
        if (businessType) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.merchantProfiles.businessType, businessType));
        }
        // Rating filter
        if (rating) {
            whereConditions.push((0, drizzle_orm_1.sql) `CAST(${schema_1.merchantProfiles.rating} AS DECIMAL) >= ${Number(rating)}`);
        }
        // Verification filter
        if (isVerified !== undefined) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.merchantProfiles.isVerified, isVerified === 'true'));
        }
        let merchantQuery = database_1.default.select({
            id: schema_1.users.id,
            userId: schema_1.users.userId,
            fullName: schema_1.users.fullName,
            profilePicture: schema_1.users.profilePicture,
            city: schema_1.users.city,
            state: schema_1.users.state,
            latitude: schema_1.users.latitude,
            longitude: schema_1.users.longitude,
            businessName: schema_1.merchantProfiles.businessName,
            businessType: schema_1.merchantProfiles.businessType,
            businessAddress: schema_1.merchantProfiles.businessAddress,
            businessDescription: schema_1.merchantProfiles.businessDescription,
            businessHours: schema_1.merchantProfiles.businessHours,
            rating: schema_1.merchantProfiles.rating,
            reviewCount: schema_1.merchantProfiles.reviewCount,
            isVerified: schema_1.merchantProfiles.isVerified,
            distance: (0, drizzle_orm_1.sql) `6371 * acos(cos(radians(${Number(latitude)})) * cos(radians(CAST(${schema_1.users.latitude} AS DECIMAL))) * cos(radians(CAST(${schema_1.users.longitude} AS DECIMAL)) - radians(${Number(longitude)})) + sin(radians(${Number(latitude)})) * sin(radians(CAST(${schema_1.users.latitude} AS DECIMAL))))`
        })
            .from(schema_1.users)
            .innerJoin(schema_1.merchantProfiles, (0, drizzle_orm_1.eq)(schema_1.users.id, schema_1.merchantProfiles.userId))
            .where((0, drizzle_orm_1.and)(...whereConditions))
            .having((0, drizzle_orm_1.sql) `6371 * acos(cos(radians(${Number(latitude)})) * cos(radians(CAST(${schema_1.users.latitude} AS DECIMAL))) * cos(radians(CAST(${schema_1.users.longitude} AS DECIMAL)) - radians(${Number(longitude)})) + sin(radians(${Number(latitude)})) * sin(radians(CAST(${schema_1.users.latitude} AS DECIMAL)))) <= ${Number(radius)}`);
        // Sorting
        switch (sortBy) {
            case 'rating':
                merchantQuery = merchantQuery.orderBy((0, drizzle_orm_1.desc)((0, drizzle_orm_1.sql) `CAST(${schema_1.merchantProfiles.rating} AS DECIMAL)`));
                break;
            case 'name':
                merchantQuery = merchantQuery.orderBy((0, drizzle_orm_1.asc)(schema_1.merchantProfiles.businessName));
                break;
            default: // distance
                merchantQuery = merchantQuery.orderBy((0, drizzle_orm_1.asc)((0, drizzle_orm_1.sql) `6371 * acos(cos(radians(${Number(latitude)})) * cos(radians(CAST(${schema_1.users.latitude} AS DECIMAL))) * cos(radians(CAST(${schema_1.users.longitude} AS DECIMAL)) - radians(${Number(longitude)})) + sin(radians(${Number(latitude)})) * sin(radians(CAST(${schema_1.users.latitude} AS DECIMAL))))`));
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
    }
    catch (error) {
        console.error('Merchant search error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get suggestions/autocomplete
router.get('/suggestions', async (req, res) => {
    try {
        const { q, type = 'all' } = req.query;
        if (!q || q.length < 2) {
            return res.json({ suggestions: [] });
        }
        const suggestions = [];
        // Product suggestions
        if (type === 'all' || type === 'products') {
            const productSuggestions = await database_1.default.select({
                id: schema_1.products.id,
                name: schema_1.products.name,
                type: (0, drizzle_orm_1.sql) `'product'`,
                image: schema_1.products.image,
                price: schema_1.products.price
            })
                .from(schema_1.products)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.products.isActive, true), (0, drizzle_orm_1.like)(schema_1.products.name, `%${q}%`)))
                .limit(5);
            suggestions.push(...productSuggestions);
        }
        // Category suggestions
        if (type === 'all' || type === 'categories') {
            const categorySuggestions = await database_1.default.select({
                id: schema_1.categories.id,
                name: schema_1.categories.name,
                type: (0, drizzle_orm_1.sql) `'category'`,
                icon: schema_1.categories.icon
            })
                .from(schema_1.categories)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.categories.isActive, true), (0, drizzle_orm_1.like)(schema_1.categories.name, `%${q}%`)))
                .limit(3);
            suggestions.push(...categorySuggestions);
        }
        // Merchant suggestions
        if (type === 'all' || type === 'merchants') {
            const merchantSuggestions = await database_1.default.select({
                id: schema_1.users.id,
                name: schema_1.merchantProfiles.businessName,
                type: (0, drizzle_orm_1.sql) `'merchant'`,
                image: schema_1.users.profilePicture,
                rating: schema_1.merchantProfiles.rating
            })
                .from(schema_1.users)
                .innerJoin(schema_1.merchantProfiles, (0, drizzle_orm_1.eq)(schema_1.users.id, schema_1.merchantProfiles.userId))
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.users.role, 'MERCHANT'), (0, drizzle_orm_1.eq)(schema_1.users.isActive, true), (0, drizzle_orm_1.like)(schema_1.merchantProfiles.businessName, `%${q}%`)))
                .limit(3);
            suggestions.push(...merchantSuggestions);
        }
        res.json({ suggestions });
    }
    catch (error) {
        console.error('Search suggestions error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Popular/trending searches
router.get('/trending', async (req, res) => {
    try {
        // This would typically come from analytics/search logs
        // For now, we'll return popular categories and products
        const popularCategories = await database_1.default.select({
            id: schema_1.categories.id,
            name: schema_1.categories.name,
            icon: schema_1.categories.icon,
            productCount: (0, drizzle_orm_1.sql) `(SELECT COUNT(*) FROM ${schema_1.products} WHERE ${schema_1.products.categoryId} = ${schema_1.categories.id} AND ${schema_1.products.isActive} = true)`
        })
            .from(schema_1.categories)
            .where((0, drizzle_orm_1.eq)(schema_1.categories.isActive, true))
            .orderBy((0, drizzle_orm_1.desc)((0, drizzle_orm_1.sql) `(SELECT COUNT(*) FROM ${schema_1.products} WHERE ${schema_1.products.categoryId} = ${schema_1.categories.id} AND ${schema_1.products.isActive} = true)`))
            .limit(5);
        const popularProducts = await database_1.default.select({
            id: schema_1.products.id,
            name: schema_1.products.name,
            image: schema_1.products.image,
            price: schema_1.products.price,
            rating: schema_1.products.rating,
            reviewCount: schema_1.products.reviewCount
        })
            .from(schema_1.products)
            .where((0, drizzle_orm_1.eq)(schema_1.products.isActive, true))
            .orderBy((0, drizzle_orm_1.desc)((0, drizzle_orm_1.sql) `CAST(${schema_1.products.rating} AS DECIMAL) * ${schema_1.products.reviewCount}`))
            .limit(10);
        res.json({
            trending: {
                categories: popularCategories,
                products: popularProducts
            }
        });
    }
    catch (error) {
        console.error('Trending search error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=search.js.map