import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../utils/auth';
import { ValidationMiddleware } from '../middleware/validation';
import db from '../config/database';
import { reviews, orders, users, products } from '../schema';
import { eq, and, desc, avg, count } from 'drizzle-orm';

const router = Router();

// Validation schemas
const CreateReviewSchema = z.object({
  orderId: z.string().uuid(),
  rating: z.number().min(1).max(5),
  comment: z.string().min(1).max(500).optional(),
  reviewType: z.enum(['PRODUCT', 'DELIVERY', 'SELLER']).default('PRODUCT')
});

const UpdateReviewSchema = z.object({
  rating: z.number().min(1).max(5).optional(),
  comment: z.string().min(1).max(500).optional()
});

const ReviewQuerySchema = z.object({
  page: z.string().transform(val => parseInt(val) || 1),
  limit: z.string().transform(val => Math.min(parseInt(val) || 10, 50)),
  rating: z.string().optional(),
  reviewType: z.enum(['PRODUCT', 'DELIVERY', 'SELLER']).optional()
});

// Create a review
router.post('/', 
  authenticateToken,
  ValidationMiddleware.validate({ body: CreateReviewSchema }),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      const { orderId, rating, comment, reviewType } = req.body;

      // Verify order exists and belongs to user
      const [order] = await db.select()
        .from(orders)
        .where(and(
          eq(orders.id, parseInt(orderId)),
          eq(orders.customerId, userId),
          eq(orders.status, 'DELIVERED')
        ))
        .limit(1);

      if (!order) {
        return res.status(404).json({
          error: 'Order not found or not eligible for review'
        });
      }

      // Check if review already exists
      const [existingReview] = await db.select()
        .from(reviews)
        .where(and(
          eq(reviews.orderId, parseInt(orderId)),
          eq(reviews.userId, userId),
          eq(reviews.reviewType, reviewType)
        ))
        .limit(1);

      if (existingReview) {
        return res.status(400).json({
          error: 'Review already exists for this order'
        });
      }

      const [newReview] = await db.insert(reviews).values({
        userId,
        orderId: parseInt(orderId),
        productId: order.productId,
        merchantId: order.merchantId,
        driverId: order.driverId,
        rating,
        comment,
        reviewType,
        createdAt: new Date()
      }).returning();

      res.status(201).json({
        success: true,
        data: newReview
      });
    } catch (error) {
      console.error('Create review error:', error);
      res.status(500).json({ error: 'Failed to create review' });
    }
  }
);

// Get reviews for a product
router.get('/product/:productId',
  ValidationMiddleware.validate({ 
    params: z.object({ productId: z.string() }),
    query: ReviewQuerySchema 
  }),
  async (req: Request, res: Response) => {
    try {
      const { productId } = req.params;
      const { page, limit, rating, reviewType } = req.query as any;
      const offset = (page - 1) * limit;

      let whereConditions = [eq(reviews.productId, parseInt(productId))];

      if (rating) {
        whereConditions.push(eq(reviews.rating, parseInt(rating)));
      }

      if (reviewType) {
        whereConditions.push(eq(reviews.reviewType, reviewType));
      }

      const [reviewsData, totalCount, averageRating] = await Promise.all([
        db.select({
          id: reviews.id,
          rating: reviews.rating,
          comment: reviews.comment,
          reviewType: reviews.reviewType,
          createdAt: reviews.createdAt,
          user: {
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            profileImage: users.profileImage
          }
        })
        .from(reviews)
        .leftJoin(users, eq(reviews.userId, users.id))
        .where(and(...whereConditions))
        .orderBy(desc(reviews.createdAt))
        .limit(limit)
        .offset(offset),

        db.select({ count: count() })
          .from(reviews)
          .where(and(...whereConditions))
          .then(result => result[0].count),

        db.select({ avg: avg(reviews.rating) })
          .from(reviews)
          .where(eq(reviews.productId, parseInt(productId)))
          .then(result => result[0].avg)
      ]);

      res.json({
        success: true,
        data: {
          reviews: reviewsData,
          pagination: {
            page,
            limit,
            total: totalCount,
            pages: Math.ceil(totalCount / limit)
          },
          statistics: {
            averageRating: parseFloat(averageRating || '0'),
            totalReviews: totalCount
          }
        }
      });
    } catch (error) {
      console.error('Get product reviews error:', error);
      res.status(500).json({ error: 'Failed to fetch reviews' });
    }
  }
);

// Get reviews by user
router.get('/user/:userId',
  ValidationMiddleware.validate({ 
    params: z.object({ userId: z.string() }),
    query: ReviewQuerySchema 
  }),
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { page, limit, reviewType } = req.query as any;
      const offset = (page - 1) * limit;

      let whereConditions = [eq(reviews.userId, parseInt(userId))];

      if (reviewType) {
        whereConditions.push(eq(reviews.reviewType, reviewType));
      }

      const [userReviews, totalCount] = await Promise.all([
        db.select({
          id: reviews.id,
          rating: reviews.rating,
          comment: reviews.comment,
          reviewType: reviews.reviewType,
          createdAt: reviews.createdAt,
          product: {
            id: products.id,
            name: products.name,
            image: products.image
          }
        })
        .from(reviews)
        .leftJoin(products, eq(reviews.productId, products.id))
        .where(and(...whereConditions))
        .orderBy(desc(reviews.createdAt))
        .limit(limit)
        .offset(offset),

        db.select({ count: count() })
          .from(reviews)
          .where(and(...whereConditions))
          .then(result => result[0].count)
      ]);

      res.json({
        success: true,
        data: {
          reviews: userReviews,
          pagination: {
            page,
            limit,
            total: totalCount,
            pages: Math.ceil(totalCount / limit)
          }
        }
      });
    } catch (error) {
      console.error('Get user reviews error:', error);
      res.status(500).json({ error: 'Failed to fetch user reviews' });
    }
  }
);

// Update a review
router.put('/:reviewId',
  authenticateToken,
  ValidationMiddleware.validate({ 
    params: z.object({ reviewId: z.string() }),
    body: UpdateReviewSchema 
  }),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      const { reviewId } = req.params;
      const updates = req.body;

      // Verify review belongs to user
      const [existingReview] = await db.select()
        .from(reviews)
        .where(and(
          eq(reviews.id, parseInt(reviewId)),
          eq(reviews.userId, userId)
        ))
        .limit(1);

      if (!existingReview) {
        return res.status(404).json({
          error: 'Review not found or not authorized'
        });
      }

      const [updatedReview] = await db.update(reviews)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(reviews.id, parseInt(reviewId)))
        .returning();

      res.json({
        success: true,
        data: updatedReview
      });
    } catch (error) {
      console.error('Update review error:', error);
      res.status(500).json({ error: 'Failed to update review' });
    }
  }
);

// Delete a review
router.delete('/:reviewId',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      const { reviewId } = req.params;

      // Verify review belongs to user
      const [existingReview] = await db.select()
        .from(reviews)
        .where(and(
          eq(reviews.id, parseInt(reviewId)),
          eq(reviews.userId, userId)
        ))
        .limit(1);

      if (!existingReview) {
        return res.status(404).json({
          error: 'Review not found or not authorized'
        });
      }

      await db.delete(reviews)
        .where(eq(reviews.id, parseInt(reviewId)));

      res.json({
        success: true,
        message: 'Review deleted successfully'
      });
    } catch (error) {
      console.error('Delete review error:', error);
      res.status(500).json({ error: 'Failed to delete review' });
    }
  }
);

// Get review statistics for a merchant
router.get('/merchant/:merchantId/stats',
  async (req: Request, res: Response) => {
    try {
      const { merchantId } = req.params;

      const stats = await db.select({
        avgRating: avg(reviews.rating),
        totalReviews: count(reviews.id),
        rating: reviews.rating
      })
      .from(reviews)
      .where(eq(reviews.merchantId, parseInt(merchantId)))
      .groupBy(reviews.rating);

      const summary = {
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: {
          1: 0, 2: 0, 3: 0, 4: 0, 5: 0
        }
      };

      let totalRating = 0;
      stats.forEach(stat => {
        const count = Number(stat.totalReviews);
        summary.totalReviews += count;
        totalRating += Number(stat.rating) * count;
        summary.ratingDistribution[stat.rating as keyof typeof summary.ratingDistribution] = count;
      });

      summary.averageRating = summary.totalReviews > 0 ? totalRating / summary.totalReviews : 0;

      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      console.error('Get merchant review stats error:', error);
      res.status(500).json({ error: 'Failed to fetch review statistics' });
    }
  }
);

export default router;
<line_number>1</line_number>
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../utils/auth';
import { ValidationMiddleware } from '../middleware/validation';
import db from '../config/database';
import { reviews, orders, users, products } from '../schema';
import { eq, and, desc, avg, count } from 'drizzle-orm';

const router = Router();

// Validation schemas
const CreateReviewSchema = z.object({
  targetType: z.enum(['PRODUCT', 'MERCHANT', 'DRIVER']),
  targetId: z.string(),
  orderId: z.string().optional(),
  rating: z.number().min(1).max(5),
  comment: z.string().min(1).max(500).optional()
});

const UpdateReviewSchema = z.object({
  rating: z.number().min(1).max(5).optional(),
  comment: z.string().min(1).max(500).optional()
});

const ReviewQuerySchema = z.object({
  page: z.string().transform(val => parseInt(val) || 1),
  limit: z.string().transform(val => Math.min(parseInt(val) || 10, 50)),
  rating: z.string().optional()
});

// Create a review
router.post('/', 
  authenticateToken,
  ValidationMiddleware.validate({ body: CreateReviewSchema }),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;
      const { targetType, targetId, orderId, rating, comment } = req.body;

      // If reviewing a product, verify order exists and is delivered
      if (targetType === 'PRODUCT' && orderId) {
        const [order] = await db.select()
          .from(orders)
          .where(and(
            eq(orders.id, parseInt(orderId)),
            eq(orders.buyerId, userId),
            eq(orders.status, 'delivered')
          ))
          .limit(1);

        if (!order) {
          return res.status(404).json({
            error: 'Order not found or not eligible for review'
          });
        }
      }

      // Check if review already exists
      const [existingReview] = await db.select()
        .from(reviews)
        .where(and(
          eq(reviews.userId, userId),
          eq(reviews.targetType, targetType),
          eq(reviews.targetId, parseInt(targetId))
        ))
        .limit(1);

      if (existingReview) {
        return res.status(400).json({
          error: 'Review already exists for this item'
        });
      }

      const [newReview] = await db.insert(reviews).values({
        userId,
        targetType: targetType as any,
        targetId: parseInt(targetId),
        orderId: orderId ? parseInt(orderId) : null,
        rating,
        comment,
        createdAt: new Date()
      }).returning();

      res.status(201).json({
        success: true,
        message: 'Review created successfully',
        data: newReview
      });
    } catch (error) {
      console.error('Create review error:', error);
      res.status(500).json({ error: 'Failed to create review' });
    }
  }
);

// Get reviews for a product
router.get('/product/:productId',
  ValidationMiddleware.validate({ 
    params: z.object({ productId: z.string() }),
    query: ReviewQuerySchema 
  }),
  async (req: Request, res: Response) => {
    try {
      const { productId } = req.params;
      const { page, limit, rating } = req.query as any;
      const offset = (page - 1) * limit;

      let whereConditions = [
        eq(reviews.targetType, 'PRODUCT'),
        eq(reviews.targetId, parseInt(productId))
      ];

      if (rating) {
        whereConditions.push(eq(reviews.rating, parseInt(rating)));
      }

      const [reviewsData, totalCount, averageRating] = await Promise.all([
        db.select({
          id: reviews.id,
          rating: reviews.rating,
          comment: reviews.comment,
          createdAt: reviews.createdAt,
          user: {
            id: users.id,
            fullName: users.fullName,
            profilePicture: users.profilePicture
          }
        })
        .from(reviews)
        .leftJoin(users, eq(reviews.userId, users.id))
        .where(and(...whereConditions))
        .orderBy(desc(reviews.createdAt))
        .limit(limit)
        .offset(offset),

        db.select({ count: count() })
          .from(reviews)
          .where(and(...whereConditions))
          .then(result => result[0].count),

        db.select({ avg: avg(reviews.rating) })
          .from(reviews)
          .where(and(
            eq(reviews.targetType, 'PRODUCT'),
            eq(reviews.targetId, parseInt(productId))
          ))
          .then(result => result[0].avg)
      ]);

      res.json({
        success: true,
        data: {
          reviews: reviewsData,
          pagination: {
            page,
            limit,
            total: totalCount,
            pages: Math.ceil(totalCount / limit)
          },
          statistics: {
            averageRating: parseFloat(averageRating || '0'),
            totalReviews: totalCount
          }
        }
      });
    } catch (error) {
      console.error('Get product reviews error:', error);
      res.status(500).json({ error: 'Failed to fetch reviews' });
    }
  }
);

// Get reviews by user
router.get('/user/:userId',
  ValidationMiddleware.validate({ 
    params: z.object({ userId: z.string() }),
    query: ReviewQuerySchema 
  }),
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { page, limit } = req.query as any;
      const offset = (page - 1) * limit;

      const [userReviews, totalCount] = await Promise.all([
        db.select({
          id: reviews.id,
          rating: reviews.rating,
          comment: reviews.comment,
          targetType: reviews.targetType,
          createdAt: reviews.createdAt,
          product: {
            id: products.id,
            name: products.name,
            image: products.image
          }
        })
        .from(reviews)
        .leftJoin(products, and(
          eq(reviews.targetType, 'PRODUCT'),
          eq(reviews.targetId, products.id)
        ))
        .where(eq(reviews.userId, parseInt(userId)))
        .orderBy(desc(reviews.createdAt))
        .limit(limit)
        .offset(offset),

        db.select({ count: count() })
          .from(reviews)
          .where(eq(reviews.userId, parseInt(userId)))
          .then(result => result[0].count)
      ]);

      res.json({
        success: true,
        data: {
          reviews: userReviews,
          pagination: {
            page,
            limit,
            total: totalCount,
            pages: Math.ceil(totalCount / limit)
          }
        }
      });
    } catch (error) {
      console.error('Get user reviews error:', error);
      res.status(500).json({ error: 'Failed to fetch user reviews' });
    }
  }
);

// Update review
router.put('/:reviewId',
  authenticateToken,
  ValidationMiddleware.validate({ 
    params: z.object({ reviewId: z.string() }),
    body: UpdateReviewSchema 
  }),
  async (req: Request, res: Response) => {
    try {
      const { reviewId } = req.params;
      const userId = (req as any).user?.userId;
      const updates = req.body;

      const [existingReview] = await db.select()
        .from(reviews)
        .where(and(
          eq(reviews.id, parseInt(reviewId)),
          eq(reviews.userId, userId)
        ))
        .limit(1);

      if (!existingReview) {
        return res.status(404).json({
          error: 'Review not found or not authorized'
        });
      }

      const [updatedReview] = await db.update(reviews)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(eq(reviews.id, parseInt(reviewId)))
        .returning();

      res.json({
        success: true,
        message: 'Review updated successfully',
        data: updatedReview
      });
    } catch (error) {
      console.error('Update review error:', error);
      res.status(500).json({ error: 'Failed to update review' });
    }
  }
);

// Delete review
router.delete('/:reviewId',
  authenticateToken,
  ValidationMiddleware.validate({ 
    params: z.object({ reviewId: z.string() })
  }),
  async (req: Request, res: Response) => {
    try {
      const { reviewId } = req.params;
      const userId = (req as any).user?.userId;

      const [existingReview] = await db.select()
        .from(reviews)
        .where(and(
          eq(reviews.id, parseInt(reviewId)),
          eq(reviews.userId, userId)
        ))
        .limit(1);

      if (!existingReview) {
        return res.status(404).json({
          error: 'Review not found or not authorized'
        });
      }

      await db.delete(reviews)
        .where(eq(reviews.id, parseInt(reviewId)));

      res.json({
        success: true,
        message: 'Review deleted successfully'
      });
    } catch (error) {
      console.error('Delete review error:', error);
      res.status(500).json({ error: 'Failed to delete review' });
    }
  }
);

export default router;
