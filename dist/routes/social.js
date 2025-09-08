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
// Create vendor post
router.post('/posts', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('MERCHANT'), async (req, res) => {
    try {
        const vendorId = req.user.userId;
        const { title, content, postType, productId, images, tags, originalPrice, discountPrice, discountPercentage, validUntil, } = req.body;
        if (!title || !content || !postType) {
            return res.status(400).json({ error: 'Title, content, and postType are required' });
        }
        const validPostTypes = ['PRODUCT_UPDATE', 'NEW_PRODUCT', 'PROMOTION', 'ANNOUNCEMENT', 'RESTOCK'];
        if (!validPostTypes.includes(postType)) {
            return res.status(400).json({ error: 'Invalid post type' });
        }
        // If productId is provided, verify it belongs to the vendor
        if (productId) {
            const product = await database_1.default.select().from(schema_1.products).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.products.id, productId), (0, drizzle_orm_1.eq)(schema_1.products.sellerId, vendorId)));
            if (product.length === 0) {
                return res.status(400).json({ error: 'Product not found or does not belong to you' });
            }
        }
        const post = await database_1.default.insert(schema_1.vendorPosts).values({
            vendorId,
            title,
            content,
            postType: postType,
            productId,
            images,
            tags,
            originalPrice: originalPrice?.toString(),
            discountPrice: discountPrice?.toString(),
            discountPercentage,
            validUntil: validUntil ? new Date(validUntil) : null,
        }).returning();
        res.status(201).json({
            message: 'Post created successfully',
            post: post[0],
        });
    }
    catch (error) {
        console.error('Create post error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get vendor posts feed
router.get('/posts', async (req, res) => {
    try {
        const { page = 1, limit = 10, vendorId, postType } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        let whereConditions = [(0, drizzle_orm_1.eq)(schema_1.vendorPosts.isActive, true)];
        if (vendorId) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.vendorPosts.vendorId, Number(vendorId)));
        }
        if (postType) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.vendorPosts.postType, postType));
        }
        const posts = await database_1.default.select({
            id: schema_1.vendorPosts.id,
            title: schema_1.vendorPosts.title,
            content: schema_1.vendorPosts.content,
            postType: schema_1.vendorPosts.postType,
            images: schema_1.vendorPosts.images,
            tags: schema_1.vendorPosts.tags,
            originalPrice: schema_1.vendorPosts.originalPrice,
            discountPrice: schema_1.vendorPosts.discountPrice,
            discountPercentage: schema_1.vendorPosts.discountPercentage,
            validUntil: schema_1.vendorPosts.validUntil,
            viewCount: schema_1.vendorPosts.viewCount,
            likeCount: schema_1.vendorPosts.likeCount,
            commentCount: schema_1.vendorPosts.commentCount,
            createdAt: schema_1.vendorPosts.createdAt,
            vendor: {
                id: schema_1.users.id,
                fullName: schema_1.users.fullName,
                profilePicture: schema_1.users.profilePicture,
                city: schema_1.users.city,
                state: schema_1.users.state,
            },
            product: {
                id: schema_1.products.id,
                name: schema_1.products.name,
                image: schema_1.products.image,
                price: schema_1.products.price,
            },
        })
            .from(schema_1.vendorPosts)
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.vendorPosts.vendorId, schema_1.users.id))
            .leftJoin(schema_1.products, (0, drizzle_orm_1.eq)(schema_1.vendorPosts.productId, schema_1.products.id))
            .where((0, drizzle_orm_1.and)(...whereConditions))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.vendorPosts.createdAt))
            .limit(Number(limit))
            .offset(offset);
        res.json({
            posts,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: posts.length,
            },
        });
    }
    catch (error) {
        console.error('Get posts error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get single post
router.get('/posts/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Increment view count
        await database_1.default.update(schema_1.vendorPosts)
            .set({ viewCount: (0, drizzle_orm_1.sql) `${schema_1.vendorPosts.viewCount} + 1` })
            .where((0, drizzle_orm_1.eq)(schema_1.vendorPosts.id, id));
        const post = await database_1.default.select({
            id: schema_1.vendorPosts.id,
            title: schema_1.vendorPosts.title,
            content: schema_1.vendorPosts.content,
            postType: schema_1.vendorPosts.postType,
            images: schema_1.vendorPosts.images,
            tags: schema_1.vendorPosts.tags,
            originalPrice: schema_1.vendorPosts.originalPrice,
            discountPrice: schema_1.vendorPosts.discountPrice,
            discountPercentage: schema_1.vendorPosts.discountPercentage,
            validUntil: schema_1.vendorPosts.validUntil,
            viewCount: schema_1.vendorPosts.viewCount,
            likeCount: schema_1.vendorPosts.likeCount,
            commentCount: schema_1.vendorPosts.commentCount,
            createdAt: schema_1.vendorPosts.createdAt,
            updatedAt: schema_1.vendorPosts.updatedAt,
            vendor: {
                id: schema_1.users.id,
                fullName: schema_1.users.fullName,
                profilePicture: schema_1.users.profilePicture,
                city: schema_1.users.city,
                state: schema_1.users.state,
            },
            product: {
                id: schema_1.products.id,
                name: schema_1.products.name,
                image: schema_1.products.image,
                price: schema_1.products.price,
                description: schema_1.products.description,
            },
        })
            .from(schema_1.vendorPosts)
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.vendorPosts.vendorId, schema_1.users.id))
            .leftJoin(schema_1.products, (0, drizzle_orm_1.eq)(schema_1.vendorPosts.productId, schema_1.products.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.vendorPosts.id, id), (0, drizzle_orm_1.eq)(schema_1.vendorPosts.isActive, true)));
        if (post.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }
        res.json(post[0]);
    }
    catch (error) {
        console.error('Get post error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Like/Unlike post
router.post('/posts/:id/like', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        // Check if post exists
        const post = await database_1.default.select().from(schema_1.vendorPosts).where((0, drizzle_orm_1.eq)(schema_1.vendorPosts.id, id));
        if (post.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }
        // Check if user already liked the post
        const existingLike = await database_1.default.select().from(schema_1.vendorPostLikes).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.vendorPostLikes.postId, id), (0, drizzle_orm_1.eq)(schema_1.vendorPostLikes.userId, userId)));
        if (existingLike.length > 0) {
            // Unlike the post
            await database_1.default.delete(schema_1.vendorPostLikes).where((0, drizzle_orm_1.eq)(schema_1.vendorPostLikes.id, existingLike[0].id));
            // Decrement like count
            await database_1.default.update(schema_1.vendorPosts)
                .set({ likeCount: (0, drizzle_orm_1.sql) `${schema_1.vendorPosts.likeCount} - 1` })
                .where((0, drizzle_orm_1.eq)(schema_1.vendorPosts.id, id));
            res.json({ message: 'Post unliked successfully', action: 'unliked' });
        }
        else {
            // Like the post
            await database_1.default.insert(schema_1.vendorPostLikes).values({
                postId: id,
                userId,
            });
            // Increment like count
            await database_1.default.update(schema_1.vendorPosts)
                .set({ likeCount: (0, drizzle_orm_1.sql) `${schema_1.vendorPosts.likeCount} + 1` })
                .where((0, drizzle_orm_1.eq)(schema_1.vendorPosts.id, id));
            res.json({ message: 'Post liked successfully', action: 'liked' });
        }
    }
    catch (error) {
        console.error('Like post error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Add comment to post
router.post('/posts/:id/comments', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const { content, parentCommentId } = req.body;
        if (!content) {
            return res.status(400).json({ error: 'Comment content is required' });
        }
        // Check if post exists
        const post = await database_1.default.select().from(schema_1.vendorPosts).where((0, drizzle_orm_1.eq)(schema_1.vendorPosts.id, id));
        if (post.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }
        // Create comment
        const comment = await database_1.default.insert(schema_1.vendorPostComments).values({
            postId: id,
            userId,
            content,
            parentCommentId,
        }).returning();
        // Increment comment count
        await database_1.default.update(schema_1.vendorPosts)
            .set({ commentCount: (0, drizzle_orm_1.sql) `${schema_1.vendorPosts.commentCount} + 1` })
            .where((0, drizzle_orm_1.eq)(schema_1.vendorPosts.id, id));
        // Get comment with user info
        const commentWithUser = await database_1.default.select({
            id: schema_1.vendorPostComments.id,
            content: schema_1.vendorPostComments.content,
            parentCommentId: schema_1.vendorPostComments.parentCommentId,
            createdAt: schema_1.vendorPostComments.createdAt,
            user: {
                id: schema_1.users.id,
                fullName: schema_1.users.fullName,
                profilePicture: schema_1.users.profilePicture,
            },
        })
            .from(schema_1.vendorPostComments)
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.vendorPostComments.userId, schema_1.users.id))
            .where((0, drizzle_orm_1.eq)(schema_1.vendorPostComments.id, comment[0].id));
        res.status(201).json({
            message: 'Comment added successfully',
            comment: commentWithUser[0],
        });
    }
    catch (error) {
        console.error('Add comment error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get post comments
router.get('/posts/:id/comments', async (req, res) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 20 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        const comments = await database_1.default.select({
            id: schema_1.vendorPostComments.id,
            content: schema_1.vendorPostComments.content,
            parentCommentId: schema_1.vendorPostComments.parentCommentId,
            createdAt: schema_1.vendorPostComments.createdAt,
            updatedAt: schema_1.vendorPostComments.updatedAt,
            user: {
                id: schema_1.users.id,
                fullName: schema_1.users.fullName,
                profilePicture: schema_1.users.profilePicture,
            },
        })
            .from(schema_1.vendorPostComments)
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.vendorPostComments.userId, schema_1.users.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.vendorPostComments.postId, id), (0, drizzle_orm_1.eq)(schema_1.vendorPostComments.isActive, true)))
            .orderBy(schema_1.vendorPostComments.createdAt)
            .limit(Number(limit))
            .offset(offset);
        res.json({
            comments,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: comments.length,
            },
        });
    }
    catch (error) {
        console.error('Get comments error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Update post (vendor only)
router.put('/posts/:id', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('MERCHANT'), async (req, res) => {
    try {
        const { id } = req.params;
        const vendorId = req.user.userId;
        const { title, content, images, tags, originalPrice, discountPrice, discountPercentage, validUntil } = req.body;
        // Check if post belongs to vendor
        const existingPost = await database_1.default.select().from(schema_1.vendorPosts).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.vendorPosts.id, id), (0, drizzle_orm_1.eq)(schema_1.vendorPosts.vendorId, vendorId)));
        if (existingPost.length === 0) {
            return res.status(404).json({ error: 'Post not found or you do not have permission to edit it' });
        }
        const updatedPost = await database_1.default.update(schema_1.vendorPosts)
            .set({
            title,
            content,
            images,
            tags,
            originalPrice: originalPrice?.toString(),
            discountPrice: discountPrice?.toString(),
            discountPercentage,
            validUntil: validUntil ? new Date(validUntil) : null,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_1.vendorPosts.id, id))
            .returning();
        res.json({
            message: 'Post updated successfully',
            post: updatedPost[0],
        });
    }
    catch (error) {
        console.error('Update post error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Delete post (vendor only)
router.delete('/posts/:id', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('MERCHANT'), async (req, res) => {
    try {
        const { id } = req.params;
        const vendorId = req.user.userId;
        // Check if post belongs to vendor
        const existingPost = await database_1.default.select().from(schema_1.vendorPosts).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.vendorPosts.id, id), (0, drizzle_orm_1.eq)(schema_1.vendorPosts.vendorId, vendorId)));
        if (existingPost.length === 0) {
            return res.status(404).json({ error: 'Post not found or you do not have permission to delete it' });
        }
        // Soft delete - mark as inactive
        await database_1.default.update(schema_1.vendorPosts)
            .set({ isActive: false })
            .where((0, drizzle_orm_1.eq)(schema_1.vendorPosts.id, id));
        res.json({ message: 'Post deleted successfully' });
    }
    catch (error) {
        console.error('Delete post error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=social.js.map