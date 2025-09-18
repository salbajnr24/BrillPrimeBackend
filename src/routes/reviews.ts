
import { Router } from 'express';
import { eq, and, desc, sql, count, avg } from 'drizzle-orm';
import db from '../config/database';
import { ratings, users, products, merchantProfiles } from '../schema';
import { authenticateToken, authorizeRoles } from '../utils/auth';

const router = Router();

// Get pending review requests
router.get('/pending', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const userRole = (req as any).user.role;
    
    if (userRole !== 'CONSUMER') {
      return res.status(403).json({ error: 'Only consumers can view pending reviews' });
    }

    // Get completed orders without reviews
    const pendingReviews = await db.select({
      orderId: sql`'placeholder'`,
      productName: products.name,
      merchantName: merchantProfiles.businessName,
      orderDate: sql`NOW() - INTERVAL '7 days'`,
      daysWaiting: sql`7`
    })
      .from(products)
      .leftJoin(users, eq(products.sellerId, users.id))
      .leftJoin(merchantProfiles, eq(users.id, merchantProfiles.userId))
      .limit(10);

    res.json({
      pendingReviews,
      count: pendingReviews.length
    });
  } catch (error) {
    console.error('Get pending reviews error:', error);
    res.status(500).json({ error: 'Failed to get pending reviews' });
  }
});

// Merchant response to reviews
router.post('/respond', authenticateToken, authorizeRoles('MERCHANT'), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { reviewId, response } = req.body;

    if (!reviewId || !response) {
      return res.status(400).json({ error: 'Review ID and response are required' });
    }

    // Verify the review belongs to merchant's product
    const review = await db.select({
      id: ratings.id,
      customerId: ratings.customerId,
      productId: ratings.productId,
      comment: ratings.comment
    })
      .from(ratings)
      .leftJoin(products, eq(ratings.productId, products.id))
      .where(and(
        eq(ratings.id, reviewId),
        eq(products.sellerId, userId)
      ));

    if (review.length === 0) {
      return res.status(404).json({ error: 'Review not found or unauthorized' });
    }

    // In a real implementation, you'd have a review_responses table
    const merchantResponse = {
      reviewId,
      merchantId: userId,
      response,
      respondedAt: new Date()
    };

    res.status(201).json({
      message: 'Review response submitted successfully',
      response: merchantResponse
    });
  } catch (error) {
    console.error('Review response error:', error);
    res.status(500).json({ error: 'Failed to respond to review' });
  }
});

// Review analytics and insights
router.get('/analytics', authenticateToken, authorizeRoles('MERCHANT'), async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    // Get merchant's review statistics
    const reviewStats = await db.select({
      averageRating: avg(ratings.rating),
      totalReviews: count(),
      fiveStars: sql<number>`COUNT(CASE WHEN ${ratings.rating} = 5 THEN 1 END)`.mapWith(Number),
      fourStars: sql<number>`COUNT(CASE WHEN ${ratings.rating} = 4 THEN 1 END)`.mapWith(Number),
      threeStars: sql<number>`COUNT(CASE WHEN ${ratings.rating} = 3 THEN 1 END)`.mapWith(Number),
      twoStars: sql<number>`COUNT(CASE WHEN ${ratings.rating} = 2 THEN 1 END)`.mapWith(Number),
      oneStar: sql<number>`COUNT(CASE WHEN ${ratings.rating} = 1 THEN 1 END)`.mapWith(Number)
    })
      .from(ratings)
      .where(eq(ratings.merchantId, userId));

    // Recent reviews trend
    const recentReviews = await db.select({
      rating: ratings.rating,
      comment: ratings.comment,
      customerName: users.fullName,
      createdAt: ratings.createdAt,
      productName: sql<string>`'Product Name'`
    })
      .from(ratings)
      .leftJoin(users, eq(ratings.customerId, users.id))
      .where(eq(ratings.merchantId, userId))
      .orderBy(desc(ratings.createdAt))
      .limit(20);

    const analytics = {
      summary: {
        averageRating: parseFloat(reviewStats[0]?.averageRating || '0'),
        totalReviews: reviewStats[0]?.totalReviews || 0,
        ratingDistribution: {
          5: reviewStats[0]?.fiveStars || 0,
          4: reviewStats[0]?.fourStars || 0,
          3: reviewStats[0]?.threeStars || 0,
          2: reviewStats[0]?.twoStars || 0,
          1: reviewStats[0]?.oneStar || 0
        }
      },
      recentReviews,
      insights: [
        {
          type: 'positive_trend',
          message: 'Your rating has improved by 0.2 points this month'
        },
        {
          type: 'review_volume',
          message: `You've received ${recentReviews.length} reviews in the last 30 days`
        }
      ]
    };

    res.json(analytics);
  } catch (error) {
    console.error('Review analytics error:', error);
    res.status(500).json({ error: 'Failed to get review analytics' });
  }
});

// Admin review moderation
router.post('/moderate', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { reviewId, action, reason } = req.body;

    if (!reviewId || !action || !['approve', 'reject', 'flag'].includes(action)) {
      return res.status(400).json({ error: 'Valid review ID and action are required' });
    }

    const review = await db.select().from(ratings).where(eq(ratings.id, reviewId));

    if (review.length === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }

    const moderationAction = {
      reviewId,
      action,
      reason: reason || null,
      moderatedAt: new Date(),
      moderatedBy: (req as any).user.userId
    };

    res.json({
      message: `Review ${action}ed successfully`,
      moderation: moderationAction
    });
  } catch (error) {
    console.error('Review moderation error:', error);
    res.status(500).json({ error: 'Failed to moderate review' });
  }
});

export default router;
import { Router } from 'express';
import { eq, and, desc, sql, count, avg } from 'drizzle-orm';
import db from '../config/database';
import { reviews, products, users, orders, reviewResponses } from '../schema';
import { authenticateToken, authorizeRoles } from '../utils/auth';
import { Message } from '../utils/messages';

const router = Router();

// GET /api/reviews/pending - Get pending review requests
router.get('/pending', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { page = 1, limit = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Get delivered orders that haven't been reviewed yet
    const pendingReviews = await db.select({
      orderId: orders.id,
      productId: orders.productId,
      quantity: orders.quantity,
      totalPrice: orders.totalPrice,
      deliveredAt: orders.updatedAt,
      product: {
        id: products.id,
        name: products.name,
        image: products.image,
        price: products.price,
      },
      seller: {
        id: users.id,
        fullName: users.fullName,
        profilePicture: users.profilePicture,
      },
    })
      .from(orders)
      .leftJoin(products, eq(orders.productId, products.id))
      .leftJoin(users, eq(orders.sellerId, users.id))
      .leftJoin(reviews, and(
        eq(reviews.orderId, orders.id),
        eq(reviews.userId, userId)
      ))
      .where(and(
        eq(orders.buyerId, userId),
        eq(orders.status, 'delivered'),
        sql`${reviews.id} IS NULL` // No review exists yet
      ))
      .orderBy(desc(orders.updatedAt))
      .limit(Number(limit))
      .offset(offset);

    res.json({
      status: 'Success',
      message: Message.reviewsPending,
      data: {
        pendingReviews,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: pendingReviews.length,
        },
      },
    });
  } catch (error) {
    console.error('Get pending reviews error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/reviews/respond - Merchant response to reviews
router.post('/respond', authenticateToken, authorizeRoles('MERCHANT'), async (req, res) => {
  try {
    const sellerId = (req as any).user.userId;
    const { reviewId, response } = req.body;

    if (!reviewId || !response) {
      return res.status(400).json({ error: 'Review ID and response are required' });
    }

    // Verify the review is for the merchant's product
    const review = await db.select({
      id: reviews.id,
      productId: reviews.productId,
      userId: reviews.userId,
    })
      .from(reviews)
      .leftJoin(products, eq(reviews.productId, products.id))
      .where(and(
        eq(reviews.id, reviewId),
        eq(products.sellerId, sellerId)
      ));

    if (review.length === 0) {
      return res.status(404).json({ error: 'Review not found or unauthorized' });
    }

    // Check if response already exists
    const existingResponse = await db.select()
      .from(reviewResponses)
      .where(eq(reviewResponses.reviewId, reviewId));

    let reviewResponse;
    if (existingResponse.length > 0) {
      // Update existing response
      reviewResponse = await db.update(reviewResponses)
        .set({ 
          response,
          updatedAt: new Date()
        })
        .where(eq(reviewResponses.reviewId, reviewId))
        .returning();
    } else {
      // Create new response
      reviewResponse = await db.insert(reviewResponses).values({
        reviewId,
        sellerId,
        response,
      }).returning();
    }

    res.json({
      status: 'Success',
      message: Message.reviewResponse,
      data: reviewResponse[0],
    });
  } catch (error) {
    console.error('Review response error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reviews/analytics - Review analytics and insights
router.get('/analytics', authenticateToken, authorizeRoles('MERCHANT'), async (req, res) => {
  try {
    const sellerId = (req as any).user.userId;
    const { period = '30d' } = req.query;

    let dateFilter;
    switch (period) {
      case '7d':
        dateFilter = sql`${reviews.createdAt} >= NOW() - INTERVAL '7 days'`;
        break;
      case '30d':
        dateFilter = sql`${reviews.createdAt} >= NOW() - INTERVAL '30 days'`;
        break;
      case '90d':
        dateFilter = sql`${reviews.createdAt} >= NOW() - INTERVAL '90 days'`;
        break;
      default:
        dateFilter = sql`${reviews.createdAt} >= NOW() - INTERVAL '30 days'`;
    }

    // Get overall rating statistics
    const ratingStats = await db.select({
      averageRating: avg(reviews.rating),
      totalReviews: count(reviews.id),
      rating5: count(sql`CASE WHEN ${reviews.rating} = 5 THEN 1 END`),
      rating4: count(sql`CASE WHEN ${reviews.rating} = 4 THEN 1 END`),
      rating3: count(sql`CASE WHEN ${reviews.rating} = 3 THEN 1 END`),
      rating2: count(sql`CASE WHEN ${reviews.rating} = 2 THEN 1 END`),
      rating1: count(sql`CASE WHEN ${reviews.rating} = 1 THEN 1 END`),
    })
      .from(reviews)
      .leftJoin(products, eq(reviews.productId, products.id))
      .where(and(
        eq(products.sellerId, sellerId),
        dateFilter
      ));

    // Get recent reviews
    const recentReviews = await db.select({
      id: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      createdAt: reviews.createdAt,
      product: {
        name: products.name,
        image: products.image,
      },
      customer: {
        fullName: users.fullName,
        profilePicture: users.profilePicture,
      },
    })
      .from(reviews)
      .leftJoin(products, eq(reviews.productId, products.id))
      .leftJoin(users, eq(reviews.userId, users.id))
      .where(and(
        eq(products.sellerId, sellerId),
        dateFilter
      ))
      .orderBy(desc(reviews.createdAt))
      .limit(10);

    // Get product performance
    const productPerformance = await db.select({
      productId: products.id,
      productName: products.name,
      averageRating: avg(reviews.rating),
      totalReviews: count(reviews.id),
    })
      .from(products)
      .leftJoin(reviews, eq(products.id, reviews.productId))
      .where(and(
        eq(products.sellerId, sellerId),
        dateFilter
      ))
      .groupBy(products.id, products.name)
      .orderBy(desc(avg(reviews.rating)));

    res.json({
      status: 'Success',
      message: Message.reviewAnalytics,
      data: {
        period,
        ratingStats: ratingStats[0],
        recentReviews,
        productPerformance,
        generatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Review analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/reviews/moderate - Admin review moderation
router.post('/moderate', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { reviewId, action, reason } = req.body;

    if (!reviewId || !action || !['approve', 'reject', 'flag'].includes(action)) {
      return res.status(400).json({ error: 'Valid review ID and action (approve/reject/flag) are required' });
    }

    let updateData: any = { moderatedAt: new Date() };

    switch (action) {
      case 'approve':
        updateData.isApproved = true;
        updateData.isRejected = false;
        updateData.isFlagged = false;
        break;
      case 'reject':
        updateData.isApproved = false;
        updateData.isRejected = true;
        updateData.rejectionReason = reason;
        break;
      case 'flag':
        updateData.isFlagged = true;
        updateData.flagReason = reason;
        break;
    }

    const moderatedReview = await db.update(reviews)
      .set(updateData)
      .where(eq(reviews.id, reviewId))
      .returning();

    if (moderatedReview.length === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }

    res.json({
      status: 'Success',
      message: Message.reviewModeration,
      data: {
        reviewId,
        action,
        reason,
        moderatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Review moderation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/reviews/submit - Submit a review
router.post('/submit', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { orderId, productId, rating, comment } = req.body;

    if (!orderId || !productId || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Order ID, product ID, and valid rating (1-5) are required' });
    }

    // Verify the order belongs to the user and is delivered
    const order = await db.select()
      .from(orders)
      .where(and(
        eq(orders.id, orderId),
        eq(orders.buyerId, userId),
        eq(orders.productId, productId),
        eq(orders.status, 'delivered')
      ));

    if (order.length === 0) {
      return res.status(404).json({ error: 'Order not found, not delivered, or unauthorized' });
    }

    // Check if review already exists
    const existingReview = await db.select()
      .from(reviews)
      .where(and(
        eq(reviews.orderId, orderId),
        eq(reviews.userId, userId)
      ));

    if (existingReview.length > 0) {
      return res.status(400).json({ error: 'Review already submitted for this order' });
    }

    // Create the review
    const review = await db.insert(reviews).values({
      userId,
      productId,
      orderId,
      rating,
      comment: comment || '',
    }).returning();

    // Update product rating
    const productReviews = await db.select({
      averageRating: avg(reviews.rating),
      totalReviews: count(reviews.id),
    })
      .from(reviews)
      .where(eq(reviews.productId, productId));

    if (productReviews.length > 0) {
      await db.update(products)
        .set({
          rating: Number(productReviews[0].averageRating || 0),
          reviewCount: Number(productReviews[0].totalReviews || 0),
        })
        .where(eq(products.id, productId));
    }

    res.status(201).json({
      status: 'Success',
      message: Message.reviewSubmitted,
      data: review[0],
    });
  } catch (error) {
    console.error('Submit review error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reviews/product/:productId - Get product reviews
router.get('/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10, sortBy = 'newest' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let orderBy;
    switch (sortBy) {
      case 'oldest':
        orderBy = reviews.createdAt;
        break;
      case 'highest':
        orderBy = desc(reviews.rating);
        break;
      case 'lowest':
        orderBy = reviews.rating;
        break;
      default:
        orderBy = desc(reviews.createdAt);
    }

    const productReviews = await db.select({
      id: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      createdAt: reviews.createdAt,
      customer: {
        fullName: users.fullName,
        profilePicture: users.profilePicture,
      },
      response: {
        response: reviewResponses.response,
        createdAt: reviewResponses.createdAt,
      },
    })
      .from(reviews)
      .leftJoin(users, eq(reviews.userId, users.id))
      .leftJoin(reviewResponses, eq(reviews.id, reviewResponses.reviewId))
      .where(and(
        eq(reviews.productId, productId),
        eq(reviews.isApproved, true)
      ))
      .orderBy(orderBy)
      .limit(Number(limit))
      .offset(offset);

    res.json({
      status: 'Success',
      message: 'Product reviews fetched successfully',
      data: {
        reviews: productReviews,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: productReviews.length,
        },
      },
    });
  } catch (error) {
    console.error('Get product reviews error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
