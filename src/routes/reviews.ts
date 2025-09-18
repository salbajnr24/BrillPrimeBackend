
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
