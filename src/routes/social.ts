import { Router } from 'express';
import { eq, and, desc, sql } from 'drizzle-orm';
import db from '../config/database';
import { vendorPosts, vendorPostLikes, vendorPostComments, users, products } from '../schema';
import { authenticateToken, authorizeRoles } from '../utils/auth';

const router = Router();

// Create vendor post
router.post('/posts', authenticateToken, authorizeRoles('MERCHANT'), async (req, res) => {
  try {
    const vendorId = (req as any).user.userId;
    const {
      title,
      content,
      postType,
      productId,
      images,
      tags,
      originalPrice,
      discountPrice,
      discountPercentage,
      validUntil,
    } = req.body;

    if (!title || !content || !postType) {
      return res.status(400).json({ error: 'Title, content, and postType are required' });
    }

    const validPostTypes = ['PRODUCT_UPDATE', 'NEW_PRODUCT', 'PROMOTION', 'ANNOUNCEMENT', 'RESTOCK'];
    if (!validPostTypes.includes(postType)) {
      return res.status(400).json({ error: 'Invalid post type' });
    }

    // If productId is provided, verify it belongs to the vendor
    if (productId) {
      const product = await db.select().from(products).where(and(
        eq(products.id, productId),
        eq(products.sellerId, vendorId)
      ));

      if (product.length === 0) {
        return res.status(400).json({ error: 'Product not found or does not belong to you' });
      }
    }

    const post = await db.insert(vendorPosts).values({
      vendorId,
      title,
      content,
      postType: postType as any,
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
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get vendor posts feed
router.get('/posts', async (req, res) => {
  try {
    const { page = 1, limit = 10, vendorId, postType } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereConditions = [eq(vendorPosts.isActive, true)];

    if (vendorId) {
      whereConditions.push(eq(vendorPosts.vendorId, Number(vendorId)));
    }

    if (postType) {
      whereConditions.push(eq(vendorPosts.postType, postType as any));
    }

    const posts = await db.select({
      id: vendorPosts.id,
      title: vendorPosts.title,
      content: vendorPosts.content,
      postType: vendorPosts.postType,
      images: vendorPosts.images,
      tags: vendorPosts.tags,
      originalPrice: vendorPosts.originalPrice,
      discountPrice: vendorPosts.discountPrice,
      discountPercentage: vendorPosts.discountPercentage,
      validUntil: vendorPosts.validUntil,
      viewCount: vendorPosts.viewCount,
      likeCount: vendorPosts.likeCount,
      commentCount: vendorPosts.commentCount,
      createdAt: vendorPosts.createdAt,
      vendor: {
        id: users.id,
        fullName: users.fullName,
        profilePicture: users.profilePicture,
        city: users.city,
        state: users.state,
      },
      product: {
        id: products.id,
        name: products.name,
        image: products.image,
        price: products.price,
      },
    })
      .from(vendorPosts)
      .leftJoin(users, eq(vendorPosts.vendorId, users.id))
      .leftJoin(products, eq(vendorPosts.productId, products.id))
      .where(and(...whereConditions))
      .orderBy(desc(vendorPosts.createdAt))
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
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single post
router.get('/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Increment view count
    await db.update(vendorPosts)
      .set({ viewCount: sql`${vendorPosts.viewCount} + 1` })
      .where(eq(vendorPosts.id, id));

    const post = await db.select({
      id: vendorPosts.id,
      title: vendorPosts.title,
      content: vendorPosts.content,
      postType: vendorPosts.postType,
      images: vendorPosts.images,
      tags: vendorPosts.tags,
      originalPrice: vendorPosts.originalPrice,
      discountPrice: vendorPosts.discountPrice,
      discountPercentage: vendorPosts.discountPercentage,
      validUntil: vendorPosts.validUntil,
      viewCount: vendorPosts.viewCount,
      likeCount: vendorPosts.likeCount,
      commentCount: vendorPosts.commentCount,
      createdAt: vendorPosts.createdAt,
      updatedAt: vendorPosts.updatedAt,
      vendor: {
        id: users.id,
        fullName: users.fullName,
        profilePicture: users.profilePicture,
        city: users.city,
        state: users.state,
      },
      product: {
        id: products.id,
        name: products.name,
        image: products.image,
        price: products.price,
        description: products.description,
      },
    })
      .from(vendorPosts)
      .leftJoin(users, eq(vendorPosts.vendorId, users.id))
      .leftJoin(products, eq(vendorPosts.productId, products.id))
      .where(and(eq(vendorPosts.id, id), eq(vendorPosts.isActive, true)));

    if (post.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json(post[0]);
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Like/Unlike post
router.post('/posts/:id/like', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    // Check if post exists
    const post = await db.select().from(vendorPosts).where(eq(vendorPosts.id, id));
    if (post.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check if user already liked the post
    const existingLike = await db.select().from(vendorPostLikes).where(and(
      eq(vendorPostLikes.postId, id),
      eq(vendorPostLikes.userId, userId)
    ));

    if (existingLike.length > 0) {
      // Unlike the post
      await db.delete(vendorPostLikes).where(eq(vendorPostLikes.id, existingLike[0].id));
      
      // Decrement like count
      await db.update(vendorPosts)
        .set({ likeCount: sql`${vendorPosts.likeCount} - 1` })
        .where(eq(vendorPosts.id, id));

      res.json({ message: 'Post unliked successfully', action: 'unliked' });
    } else {
      // Like the post
      await db.insert(vendorPostLikes).values({
        postId: id,
        userId,
      });

      // Increment like count
      await db.update(vendorPosts)
        .set({ likeCount: sql`${vendorPosts.likeCount} + 1` })
        .where(eq(vendorPosts.id, id));

      res.json({ message: 'Post liked successfully', action: 'liked' });
    }
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add comment to post
router.post('/posts/:id/comments', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    const { content, parentCommentId } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    // Check if post exists
    const post = await db.select().from(vendorPosts).where(eq(vendorPosts.id, id));
    if (post.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Create comment
    const comment = await db.insert(vendorPostComments).values({
      postId: id,
      userId,
      content,
      parentCommentId,
    }).returning();

    // Increment comment count
    await db.update(vendorPosts)
      .set({ commentCount: sql`${vendorPosts.commentCount} + 1` })
      .where(eq(vendorPosts.id, id));

    // Get comment with user info
    const commentWithUser = await db.select({
      id: vendorPostComments.id,
      content: vendorPostComments.content,
      parentCommentId: vendorPostComments.parentCommentId,
      createdAt: vendorPostComments.createdAt,
      user: {
        id: users.id,
        fullName: users.fullName,
        profilePicture: users.profilePicture,
      },
    })
      .from(vendorPostComments)
      .leftJoin(users, eq(vendorPostComments.userId, users.id))
      .where(eq(vendorPostComments.id, comment[0].id));

    res.status(201).json({
      message: 'Comment added successfully',
      comment: commentWithUser[0],
    });
  } catch (error) {
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

    const comments = await db.select({
      id: vendorPostComments.id,
      content: vendorPostComments.content,
      parentCommentId: vendorPostComments.parentCommentId,
      createdAt: vendorPostComments.createdAt,
      updatedAt: vendorPostComments.updatedAt,
      user: {
        id: users.id,
        fullName: users.fullName,
        profilePicture: users.profilePicture,
      },
    })
      .from(vendorPostComments)
      .leftJoin(users, eq(vendorPostComments.userId, users.id))
      .where(and(
        eq(vendorPostComments.postId, id),
        eq(vendorPostComments.isActive, true)
      ))
      .orderBy(vendorPostComments.createdAt)
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
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update post (vendor only)
router.put('/posts/:id', authenticateToken, authorizeRoles('MERCHANT'), async (req, res) => {
  try {
    const { id } = req.params;
    const vendorId = (req as any).user.userId;
    const { title, content, images, tags, originalPrice, discountPrice, discountPercentage, validUntil } = req.body;

    // Check if post belongs to vendor
    const existingPost = await db.select().from(vendorPosts).where(and(
      eq(vendorPosts.id, id),
      eq(vendorPosts.vendorId, vendorId)
    ));

    if (existingPost.length === 0) {
      return res.status(404).json({ error: 'Post not found or you do not have permission to edit it' });
    }

    const updatedPost = await db.update(vendorPosts)
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
      .where(eq(vendorPosts.id, id))
      .returning();

    res.json({
      message: 'Post updated successfully',
      post: updatedPost[0],
    });
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete post (vendor only)
router.delete('/posts/:id', authenticateToken, authorizeRoles('MERCHANT'), async (req, res) => {
  try {
    const { id } = req.params;
    const vendorId = (req as any).user.userId;

    // Check if post belongs to vendor
    const existingPost = await db.select().from(vendorPosts).where(and(
      eq(vendorPosts.id, id),
      eq(vendorPosts.vendorId, vendorId)
    ));

    if (existingPost.length === 0) {
      return res.status(404).json({ error: 'Post not found or you do not have permission to delete it' });
    }

    // Soft delete - mark as inactive
    await db.update(vendorPosts)
      .set({ isActive: false })
      .where(eq(vendorPosts.id, id));

    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;