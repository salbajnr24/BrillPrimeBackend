
import { Router } from 'express';
import { eq, and, or, desc, gte, lte, count, inArray, like, sql } from 'drizzle-orm';
import db from '../config/database';
import { users, contentReports, moderationResponses } from '../schema';
import { authenticateToken, authorizeRoles } from '../utils/auth';

const router = Router();

// Get moderation reports with filtering
router.get('/reports', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { 
      page = '1', 
      limit = '20', 
      status = '', 
      contentType = '', 
      priority = '',
      search = '',
      startDate = '',
      endDate = ''
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    let whereConditions = [];

    if (status) whereConditions.push(eq(contentReports.status, status as string));
    if (contentType) whereConditions.push(eq(contentReports.contentType, contentType as string));
    if (startDate) whereConditions.push(gte(contentReports.createdAt, new Date(startDate as string)));
    if (endDate) whereConditions.push(lte(contentReports.createdAt, new Date(endDate as string)));

    if (search) {
      const searchTerm = `%${search}%`;
      whereConditions.push(
        or(
          like(contentReports.reason, searchTerm),
          like(users.fullName, searchTerm),
          like(users.email, searchTerm)
        )
      );
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const reports = await db
      .select({
        id: contentReports.id,
        contentType: contentReports.contentType,
        contentId: contentReports.contentId,
        reason: contentReports.reason,
        status: contentReports.status,
        createdAt: contentReports.createdAt,
        updatedAt: contentReports.updatedAt,
        priority: sql<string>`CASE 
          WHEN ${contentReports.contentType} = 'USER' THEN 'HIGH'
          WHEN ${contentReports.createdAt} < NOW() - INTERVAL '24 hours' THEN 'HIGH'
          ELSE 'MEDIUM'
        END`.as('priority'),
        reportCount: sql<number>`(
          SELECT COUNT(*) FROM ${contentReports} cr2 
          WHERE cr2.content_id = ${contentReports.contentId} 
          AND cr2.content_type = ${contentReports.contentType}
        )`.as('reportCount'),
        reporter: {
          id: users.id,
          fullName: users.fullName,
          email: users.email,
          role: users.role
        }
      })
      .from(contentReports)
      .leftJoin(users, eq(contentReports.reportedBy, users.id))
      .where(whereClause)
      .limit(limitNum)
      .offset(offset)
      .orderBy(desc(contentReports.createdAt));

    const totalCount = await db.select({ count: count() }).from(contentReports).where(whereClause);

    // Get moderation stats
    const [pendingCount, reviewedCount, resolvedCount, todayReports] = await Promise.all([
      db.select({ count: count() }).from(contentReports).where(eq(contentReports.status, 'PENDING')),
      db.select({ count: count() }).from(contentReports).where(eq(contentReports.status, 'REVIEWED')),
      db.select({ count: count() }).from(contentReports).where(eq(contentReports.status, 'RESOLVED')),
      db.select({ count: count() }).from(contentReports).where(
        gte(contentReports.createdAt, new Date(new Date().setHours(0, 0, 0, 0)))
      )
    ]);

    const stats = {
      pending: pendingCount[0].count,
      reviewed: reviewedCount[0].count,
      resolved: resolvedCount[0].count,
      todayReports: todayReports[0].count,
      avgResolutionTime: 2.5 // Mock - would be calculated from actual data
    };

    res.json({
      success: true,
      data: {
        reports,
        stats,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalCount[0].count / limitNum),
          totalReports: totalCount[0].count,
          hasNext: pageNum * limitNum < totalCount[0].count,
          hasPrev: pageNum > 1
        }
      }
    });
  } catch (error) {
    console.error('Get moderation reports error:', error);
    res.status(500).json({ success: false, message: 'Failed to get moderation reports' });
  }
});

// Take action on report
router.post('/reports/:id/action', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const reportId = parseInt(req.params.id);
    const { action, reason, notifyUser = true } = req.body;
    const adminId = (req as any).user.id;

    const report = await db.select().from(contentReports).where(eq(contentReports.id, reportId)).limit(1);
    
    if (report.length === 0) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    // Create moderation response
    await db.insert(moderationResponses).values({
      reportId,
      adminId,
      response: reason || `Content ${action.toLowerCase()}`,
      action: action.toUpperCase(),
      createdAt: new Date()
    });

    // Update report status
    const newStatus = action === 'NO_ACTION' ? 'DISMISSED' : 'RESOLVED';
    await db.update(contentReports).set({
      status: newStatus,
      updatedAt: new Date()
    }).where(eq(contentReports.id, reportId));

    // If taking action on user content, update related reports
    if (action !== 'NO_ACTION') {
      await db.update(contentReports).set({
        status: 'RESOLVED',
        updatedAt: new Date()
      }).where(and(
        eq(contentReports.contentId, report[0].contentId),
        eq(contentReports.contentType, report[0].contentType),
        eq(contentReports.status, 'PENDING')
      ));
    }

    res.json({ 
      success: true, 
      message: `Content ${action.toLowerCase()} action completed successfully` 
    });
  } catch (error) {
    console.error('Content action error:', error);
    res.status(500).json({ success: false, message: 'Failed to complete content action' });
  }
});

// Bulk action on reports
router.post('/reports/bulk-action', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { reportIds, action, reason } = req.body;
    const adminId = (req as any).user.id;

    if (!Array.isArray(reportIds) || reportIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid report IDs' });
    }

    // Get reports for validation
    const reports = await db.select().from(contentReports).where(inArray(contentReports.id, reportIds));
    
    if (reports.length !== reportIds.length) {
      return res.status(404).json({ success: false, message: 'Some reports not found' });
    }

    // Create moderation responses for all reports
    const moderationValues = reportIds.map((reportId: number) => ({
      reportId,
      adminId,
      response: reason || `Bulk ${action.toLowerCase()}`,
      action: action.toUpperCase(),
      createdAt: new Date()
    }));

    await db.insert(moderationResponses).values(moderationValues);

    // Update report statuses
    const newStatus = action === 'NO_ACTION' ? 'DISMISSED' : 'RESOLVED';
    await db.update(contentReports).set({
      status: newStatus,
      updatedAt: new Date()
    }).where(inArray(contentReports.id, reportIds));

    res.json({ 
      success: true, 
      message: `Bulk ${action.toLowerCase()} completed for ${reportIds.length} reports` 
    });
  } catch (error) {
    console.error('Bulk moderation action error:', error);
    res.status(500).json({ success: false, message: 'Failed to complete bulk action' });
  }
});

// Get moderation statistics
router.get('/stats', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalReports,
      pendingReports,
      resolvedReports,
      todayReports,
      weekReports,
      monthReports
    ] = await Promise.all([
      db.select({ count: count() }).from(contentReports),
      db.select({ count: count() }).from(contentReports).where(eq(contentReports.status, 'PENDING')),
      db.select({ count: count() }).from(contentReports).where(eq(contentReports.status, 'RESOLVED')),
      db.select({ count: count() }).from(contentReports).where(gte(contentReports.createdAt, today)),
      db.select({ count: count() }).from(contentReports).where(gte(contentReports.createdAt, thisWeek)),
      db.select({ count: count() }).from(contentReports).where(gte(contentReports.createdAt, thisMonth))
    ]);

    const stats = {
      overview: {
        total: totalReports[0].count,
        pending: pendingReports[0].count,
        resolved: resolvedReports[0].count,
        dismissalRate: resolvedReports[0].count > 0 ? 
          Math.round((resolvedReports[0].count / totalReports[0].count) * 100) : 0
      },
      activity: {
        today: todayReports[0].count,
        thisWeek: weekReports[0].count,
        thisMonth: monthReports[0].count
      },
      performance: {
        avgResolutionTime: 2.5, // Mock - would calculate from actual data
        moderatorEfficiency: 85, // Mock - would calculate from actual data
        userSatisfactionRate: 92 // Mock - would come from user feedback
      }
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Get moderation stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to get moderation statistics' });
  }
});

export default router;
