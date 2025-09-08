
import { Router } from 'express';
import { eq, and, desc, sql, or, isNull } from 'drizzle-orm';
import db from '../config/database';
import { reports, users, products, fraudAlerts, blacklistedEntities } from '../schema';
import { authenticateToken, authorizeRoles } from '../utils/auth';

const router = Router();

// Report a user
router.post('/user/:id', authenticateToken, async (req, res) => {
  try {
    const reportedUserId = parseInt(req.params.id);
    const reporterId = (req as any).user.userId;
    const {
      reportType,
      category,
      reason,
      description,
      evidence = [],
      anonymous = false,
    } = req.body;

    // Validation
    if (!reportType || !category || !reason || !description) {
      return res.status(400).json({ 
        error: 'Required fields: reportType, category, reason, description' 
      });
    }

    // Check if reported user exists
    const reportedUser = await db.select()
      .from(users)
      .where(eq(users.id, reportedUserId))
      .limit(1);

    if (reportedUser.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent self-reporting
    if (reportedUserId === reporterId) {
      return res.status(400).json({ error: 'Cannot report yourself' });
    }

    // Check for duplicate reports (same reporter, same reported user, same type, within 24 hours)
    const existingReport = await db.select()
      .from(reports)
      .where(and(
        eq(reports.reporterId, reporterId),
        eq(reports.reportedUserId, reportedUserId),
        eq(reports.reportType, reportType),
        eq(reports.status, 'PENDING'),
        sql`${reports.createdAt} > NOW() - INTERVAL '24 hours'`
      ))
      .limit(1);

    if (existingReport.length > 0) {
      return res.status(409).json({ error: 'You have already reported this user for this reason recently' });
    }

    const report = await db.insert(reports).values({
      reporterId: anonymous ? null : reporterId,
      reportedUserId,
      reportType: reportType as any,
      category: category as any,
      reason,
      description,
      evidence,
      reporterAnonymous: anonymous,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    }).returning();

    res.status(201).json({
      message: 'User report submitted successfully',
      reportId: report[0].id,
      status: report[0].status,
    });
  } catch (error) {
    console.error('Report user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Report a product
router.post('/product/:id', authenticateToken, async (req, res) => {
  try {
    const reportedProductId = req.params.id;
    const reporterId = (req as any).user.userId;
    const {
      reportType,
      category,
      reason,
      description,
      evidence = [],
      anonymous = false,
    } = req.body;

    // Validation
    if (!reportType || !category || !reason || !description) {
      return res.status(400).json({ 
        error: 'Required fields: reportType, category, reason, description' 
      });
    }

    // Check if product exists
    const product = await db.select()
      .from(products)
      .where(eq(products.id, reportedProductId))
      .limit(1);

    if (product.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check for duplicate reports
    const existingReport = await db.select()
      .from(reports)
      .where(and(
        eq(reports.reporterId, reporterId),
        eq(reports.reportedProductId, reportedProductId),
        eq(reports.reportType, reportType),
        eq(reports.status, 'PENDING'),
        sql`${reports.createdAt} > NOW() - INTERVAL '24 hours'`
      ))
      .limit(1);

    if (existingReport.length > 0) {
      return res.status(409).json({ error: 'You have already reported this product for this reason recently' });
    }

    const report = await db.insert(reports).values({
      reporterId: anonymous ? null : reporterId,
      reportedProductId,
      reportType: reportType as any,
      category: category as any,
      reason,
      description,
      evidence,
      reporterAnonymous: anonymous,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    }).returning();

    res.status(201).json({
      message: 'Product report submitted successfully',
      reportId: report[0].id,
      status: report[0].status,
    });
  } catch (error) {
    console.error('Report product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's reports
router.get('/my-reports', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereConditions = [eq(reports.reporterId, userId)];

    if (status) {
      whereConditions.push(eq(reports.status, status as any));
    }

    const userReports = await db.select({
      id: reports.id,
      reportType: reports.reportType,
      category: reports.category,
      reason: reports.reason,
      status: reports.status,
      priority: reports.priority,
      actionTaken: reports.actionTaken,
      createdAt: reports.createdAt,
      updatedAt: reports.updatedAt,
      resolvedAt: reports.resolvedAt,
      reportedUser: {
        id: users.id,
        fullName: users.fullName,
        email: users.email,
      },
      reportedProduct: {
        id: products.id,
        name: products.name,
      },
    })
      .from(reports)
      .leftJoin(users, eq(reports.reportedUserId, users.id))
      .leftJoin(products, eq(reports.reportedProductId, products.id))
      .where(and(...whereConditions))
      .orderBy(desc(reports.createdAt))
      .limit(Number(limit))
      .offset(offset);

    // Get total count
    const totalCountResult = await db.select({
      count: sql<number>`count(*)`.mapWith(Number),
    })
      .from(reports)
      .where(and(...whereConditions));

    const totalCount = totalCountResult[0]?.count || 0;

    res.json({
      reports: userReports,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get user reports error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Get all reports
router.get('/admin/all', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { 
      status, 
      priority, 
      category, 
      reportType, 
      assignedTo, 
      page = 1, 
      limit = 20 
    } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereConditions: any[] = [];

    if (status) whereConditions.push(eq(reports.status, status as any));
    if (priority) whereConditions.push(eq(reports.priority, priority as any));
    if (category) whereConditions.push(eq(reports.category, category as any));
    if (reportType) whereConditions.push(eq(reports.reportType, reportType as any));
    if (assignedTo) whereConditions.push(eq(reports.assignedTo, Number(assignedTo)));

    const allReports = await db.select({
      report: reports,
      reporter: {
        id: users.id,
        fullName: users.fullName,
        email: users.email,
      },
      reportedUser: {
        id: users.id,
        fullName: users.fullName,
        email: users.email,
      },
      reportedProduct: {
        id: products.id,
        name: products.name,
        sellerId: products.sellerId,
      },
    })
      .from(reports)
      .leftJoin(users, eq(reports.reporterId, users.id))
      .leftJoin(users, eq(reports.reportedUserId, users.id))
      .leftJoin(products, eq(reports.reportedProductId, products.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(reports.createdAt))
      .limit(Number(limit))
      .offset(offset);

    // Get total count
    const totalCountResult = await db.select({
      count: sql<number>`count(*)`.mapWith(Number),
    })
      .from(reports)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

    const totalCount = totalCountResult[0]?.count || 0;

    res.json({
      reports: allReports,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get all reports error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Update report status
router.put('/admin/:id', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const reportId = req.params.id;
    const adminId = (req as any).user.userId;
    const {
      status,
      priority,
      assignedTo,
      adminNotes,
      resolution,
      actionTaken,
    } = req.body;

    // Check if report exists
    const existingReport = await db.select()
      .from(reports)
      .where(eq(reports.id, reportId))
      .limit(1);

    if (existingReport.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (status) {
      updateData.status = status;
      if (status === 'RESOLVED' || status === 'DISMISSED') {
        updateData.resolvedAt = new Date();
      }
    }
    if (priority) updateData.priority = priority;
    if (assignedTo) updateData.assignedTo = assignedTo;
    if (adminNotes) updateData.adminNotes = adminNotes;
    if (resolution) updateData.resolution = resolution;
    if (actionTaken) updateData.actionTaken = actionTaken;

    const updatedReport = await db.update(reports)
      .set(updateData)
      .where(eq(reports.id, reportId))
      .returning();

    res.json({
      message: 'Report updated successfully',
      report: updatedReport[0],
    });
  } catch (error) {
    console.error('Update report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Get report statistics
router.get('/admin/stats', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const statusStats = await db.select({
      status: reports.status,
      count: sql<number>`count(*)`.mapWith(Number),
    })
      .from(reports)
      .groupBy(reports.status);

    const categoryStats = await db.select({
      category: reports.category,
      count: sql<number>`count(*)`.mapWith(Number),
    })
      .from(reports)
      .groupBy(reports.category);

    const typeStats = await db.select({
      reportType: reports.reportType,
      count: sql<number>`count(*)`.mapWith(Number),
    })
      .from(reports)
      .groupBy(reports.reportType);

    const priorityStats = await db.select({
      priority: reports.priority,
      count: sql<number>`count(*)`.mapWith(Number),
    })
      .from(reports)
      .groupBy(reports.priority);

    // Recent activity (last 7 days)
    const recentActivity = await db.select({
      count: sql<number>`count(*)`.mapWith(Number),
    })
      .from(reports)
      .where(sql`${reports.createdAt} > NOW() - INTERVAL '7 days'`);

    res.json({
      byStatus: statusStats.reduce((acc, item) => {
        acc[item.status || 'unknown'] = item.count;
        return acc;
      }, {} as Record<string, number>),
      byCategory: categoryStats.reduce((acc, item) => {
        acc[item.category || 'unknown'] = item.count;
        return acc;
      }, {} as Record<string, number>),
      byType: typeStats.reduce((acc, item) => {
        acc[item.reportType || 'unknown'] = item.count;
        return acc;
      }, {} as Record<string, number>),
      byPriority: priorityStats.reduce((acc, item) => {
        acc[item.priority || 'unknown'] = item.count;
        return acc;
      }, {} as Record<string, number>),
      recentActivity: recentActivity[0]?.count || 0,
    });
  } catch (error) {
    console.error('Get report stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Fraud alerts management
router.get('/admin/fraud-alerts', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { severity, isResolved, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereConditions: any[] = [];

    if (severity) whereConditions.push(eq(fraudAlerts.severity, severity as any));
    if (isResolved !== undefined) whereConditions.push(eq(fraudAlerts.isResolved, isResolved === 'true'));

    const alerts = await db.select({
      alert: fraudAlerts,
      user: {
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
      },
    })
      .from(fraudAlerts)
      .leftJoin(users, eq(fraudAlerts.userId, users.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(fraudAlerts.createdAt))
      .limit(Number(limit))
      .offset(offset);

    const totalCountResult = await db.select({
      count: sql<number>`count(*)`.mapWith(Number),
    })
      .from(fraudAlerts)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

    const totalCount = totalCountResult[0]?.count || 0;

    res.json({
      alerts,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get fraud alerts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Resolve fraud alert
router.put('/admin/fraud-alerts/:id/resolve', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const alertId = req.params.id;
    const adminId = (req as any).user.userId;
    const { resolution } = req.body;

    if (!resolution) {
      return res.status(400).json({ error: 'Resolution is required' });
    }

    const updatedAlert = await db.update(fraudAlerts)
      .set({
        isResolved: true,
        resolvedBy: adminId,
        resolvedAt: new Date(),
        resolution,
        updatedAt: new Date(),
      })
      .where(eq(fraudAlerts.id, alertId))
      .returning();

    if (updatedAlert.length === 0) {
      return res.status(404).json({ error: 'Fraud alert not found' });
    }

    res.json({
      message: 'Fraud alert resolved successfully',
      alert: updatedAlert[0],
    });
  } catch (error) {
    console.error('Resolve fraud alert error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Blacklist management
router.post('/admin/blacklist', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const adminId = (req as any).user.userId;
    const { entityType, entityValue, reason, expiresAt } = req.body;

    if (!entityType || !entityValue || !reason) {
      return res.status(400).json({ 
        error: 'Required fields: entityType, entityValue, reason' 
      });
    }

    // Check if already blacklisted
    const existing = await db.select()
      .from(blacklistedEntities)
      .where(and(
        eq(blacklistedEntities.entityType, entityType),
        eq(blacklistedEntities.entityValue, entityValue),
        eq(blacklistedEntities.isActive, true)
      ))
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Entity is already blacklisted' });
    }

    const blacklistedEntity = await db.insert(blacklistedEntities).values({
      entityType: entityType as any,
      entityValue,
      reason,
      addedBy: adminId,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    }).returning();

    res.status(201).json({
      message: 'Entity blacklisted successfully',
      entity: blacklistedEntity[0],
    });
  } catch (error) {
    console.error('Blacklist entity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Remove from blacklist
router.delete('/admin/blacklist/:id', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const blacklistId = parseInt(req.params.id);

    const updated = await db.update(blacklistedEntities)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(blacklistedEntities.id, blacklistId))
      .returning();

    if (updated.length === 0) {
      return res.status(404).json({ error: 'Blacklisted entity not found' });
    }

    res.json({
      message: 'Entity removed from blacklist successfully',
      entity: updated[0],
    });
  } catch (error) {
    console.error('Remove from blacklist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
