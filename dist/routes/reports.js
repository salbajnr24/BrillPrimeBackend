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
// Report a user
router.post('/user/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const reportedUserId = parseInt(req.params.id);
        const reporterId = req.user.userId;
        const { reportType, category, reason, description, evidence = [], anonymous = false, } = req.body;
        // Validation
        if (!reportType || !category || !reason || !description) {
            return res.status(400).json({
                error: 'Required fields: reportType, category, reason, description'
            });
        }
        // Check if reported user exists
        const reportedUser = await database_1.default.select()
            .from(schema_1.users)
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, reportedUserId))
            .limit(1);
        if (reportedUser.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Prevent self-reporting
        if (reportedUserId === reporterId) {
            return res.status(400).json({ error: 'Cannot report yourself' });
        }
        // Check for duplicate reports (same reporter, same reported user, same type, within 24 hours)
        const existingReport = await database_1.default.select()
            .from(schema_1.reports)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.reports.reporterId, reporterId), (0, drizzle_orm_1.eq)(schema_1.reports.reportedUserId, reportedUserId), (0, drizzle_orm_1.eq)(schema_1.reports.reportType, reportType), (0, drizzle_orm_1.eq)(schema_1.reports.status, 'PENDING'), (0, drizzle_orm_1.sql) `${schema_1.reports.createdAt} > NOW() - INTERVAL '24 hours'`))
            .limit(1);
        if (existingReport.length > 0) {
            return res.status(409).json({ error: 'You have already reported this user for this reason recently' });
        }
        const report = await database_1.default.insert(schema_1.reports).values({
            reporterId: anonymous ? null : reporterId,
            reportedUserId,
            reportType: reportType,
            category: category,
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
    }
    catch (error) {
        console.error('Report user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Report a product
router.post('/product/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const reportedProductId = req.params.id;
        const reporterId = req.user.userId;
        const { reportType, category, reason, description, evidence = [], anonymous = false, } = req.body;
        // Validation
        if (!reportType || !category || !reason || !description) {
            return res.status(400).json({
                error: 'Required fields: reportType, category, reason, description'
            });
        }
        // Check if product exists
        const product = await database_1.default.select()
            .from(schema_1.products)
            .where((0, drizzle_orm_1.eq)(schema_1.products.id, reportedProductId))
            .limit(1);
        if (product.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        // Check for duplicate reports
        const existingReport = await database_1.default.select()
            .from(schema_1.reports)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.reports.reporterId, reporterId), (0, drizzle_orm_1.eq)(schema_1.reports.reportedProductId, reportedProductId), (0, drizzle_orm_1.eq)(schema_1.reports.reportType, reportType), (0, drizzle_orm_1.eq)(schema_1.reports.status, 'PENDING'), (0, drizzle_orm_1.sql) `${schema_1.reports.createdAt} > NOW() - INTERVAL '24 hours'`))
            .limit(1);
        if (existingReport.length > 0) {
            return res.status(409).json({ error: 'You have already reported this product for this reason recently' });
        }
        const report = await database_1.default.insert(schema_1.reports).values({
            reporterId: anonymous ? null : reporterId,
            reportedProductId,
            reportType: reportType,
            category: category,
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
    }
    catch (error) {
        console.error('Report product error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get user's reports
router.get('/my-reports', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { status, page = 1, limit = 10 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        let whereConditions = [(0, drizzle_orm_1.eq)(schema_1.reports.reporterId, userId)];
        if (status) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.reports.status, status));
        }
        const userReports = await database_1.default.select({
            id: schema_1.reports.id,
            reportType: schema_1.reports.reportType,
            category: schema_1.reports.category,
            reason: schema_1.reports.reason,
            status: schema_1.reports.status,
            priority: schema_1.reports.priority,
            actionTaken: schema_1.reports.actionTaken,
            createdAt: schema_1.reports.createdAt,
            updatedAt: schema_1.reports.updatedAt,
            resolvedAt: schema_1.reports.resolvedAt,
            reportedUser: {
                id: schema_1.users.id,
                fullName: schema_1.users.fullName,
                email: schema_1.users.email,
            },
            reportedProduct: {
                id: schema_1.products.id,
                name: schema_1.products.name,
            },
        })
            .from(schema_1.reports)
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.reports.reportedUserId, schema_1.users.id))
            .leftJoin(schema_1.products, (0, drizzle_orm_1.eq)(schema_1.reports.reportedProductId, schema_1.products.id))
            .where((0, drizzle_orm_1.and)(...whereConditions))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.reports.createdAt))
            .limit(Number(limit))
            .offset(offset);
        // Get total count
        const totalCountResult = await database_1.default.select({
            count: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
        })
            .from(schema_1.reports)
            .where((0, drizzle_orm_1.and)(...whereConditions));
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
    }
    catch (error) {
        console.error('Get user reports error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Admin: Get all reports
router.get('/admin/all', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('ADMIN'), async (req, res) => {
    try {
        const { status, priority, category, reportType, assignedTo, page = 1, limit = 20 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        let whereConditions = [];
        if (status)
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.reports.status, status));
        if (priority)
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.reports.priority, priority));
        if (category)
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.reports.category, category));
        if (reportType)
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.reports.reportType, reportType));
        if (assignedTo)
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.reports.assignedTo, Number(assignedTo)));
        const allReports = await database_1.default.select({
            report: schema_1.reports,
            reporter: {
                id: schema_1.users.id,
                fullName: schema_1.users.fullName,
                email: schema_1.users.email,
            },
            reportedUser: {
                id: schema_1.users.id,
                fullName: schema_1.users.fullName,
                email: schema_1.users.email,
            },
            reportedProduct: {
                id: schema_1.products.id,
                name: schema_1.products.name,
                sellerId: schema_1.products.sellerId,
            },
        })
            .from(schema_1.reports)
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.reports.reporterId, schema_1.users.id))
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.reports.reportedUserId, schema_1.users.id))
            .leftJoin(schema_1.products, (0, drizzle_orm_1.eq)(schema_1.reports.reportedProductId, schema_1.products.id))
            .where(whereConditions.length > 0 ? (0, drizzle_orm_1.and)(...whereConditions) : undefined)
            .orderBy((0, drizzle_orm_1.desc)(schema_1.reports.createdAt))
            .limit(Number(limit))
            .offset(offset);
        // Get total count
        const totalCountResult = await database_1.default.select({
            count: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
        })
            .from(schema_1.reports)
            .where(whereConditions.length > 0 ? (0, drizzle_orm_1.and)(...whereConditions) : undefined);
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
    }
    catch (error) {
        console.error('Get all reports error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Admin: Update report status
router.put('/admin/:id', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('ADMIN'), async (req, res) => {
    try {
        const reportId = req.params.id;
        const adminId = req.user.userId;
        const { status, priority, assignedTo, adminNotes, resolution, actionTaken, } = req.body;
        // Check if report exists
        const existingReport = await database_1.default.select()
            .from(schema_1.reports)
            .where((0, drizzle_orm_1.eq)(schema_1.reports.id, reportId))
            .limit(1);
        if (existingReport.length === 0) {
            return res.status(404).json({ error: 'Report not found' });
        }
        const updateData = {
            updatedAt: new Date(),
        };
        if (status) {
            updateData.status = status;
            if (status === 'RESOLVED' || status === 'DISMISSED') {
                updateData.resolvedAt = new Date();
            }
        }
        if (priority)
            updateData.priority = priority;
        if (assignedTo)
            updateData.assignedTo = assignedTo;
        if (adminNotes)
            updateData.adminNotes = adminNotes;
        if (resolution)
            updateData.resolution = resolution;
        if (actionTaken)
            updateData.actionTaken = actionTaken;
        const updatedReport = await database_1.default.update(schema_1.reports)
            .set(updateData)
            .where((0, drizzle_orm_1.eq)(schema_1.reports.id, reportId))
            .returning();
        res.json({
            message: 'Report updated successfully',
            report: updatedReport[0],
        });
    }
    catch (error) {
        console.error('Update report error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Admin: Get report statistics
router.get('/admin/stats', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('ADMIN'), async (req, res) => {
    try {
        const statusStats = await database_1.default.select({
            status: schema_1.reports.status,
            count: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
        })
            .from(schema_1.reports)
            .groupBy(schema_1.reports.status);
        const categoryStats = await database_1.default.select({
            category: schema_1.reports.category,
            count: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
        })
            .from(schema_1.reports)
            .groupBy(schema_1.reports.category);
        const typeStats = await database_1.default.select({
            reportType: schema_1.reports.reportType,
            count: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
        })
            .from(schema_1.reports)
            .groupBy(schema_1.reports.reportType);
        const priorityStats = await database_1.default.select({
            priority: schema_1.reports.priority,
            count: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
        })
            .from(schema_1.reports)
            .groupBy(schema_1.reports.priority);
        // Recent activity (last 7 days)
        const recentActivity = await database_1.default.select({
            count: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
        })
            .from(schema_1.reports)
            .where((0, drizzle_orm_1.sql) `${schema_1.reports.createdAt} > NOW() - INTERVAL '7 days'`);
        res.json({
            byStatus: statusStats.reduce((acc, item) => {
                acc[item.status || 'unknown'] = item.count;
                return acc;
            }, {}),
            byCategory: categoryStats.reduce((acc, item) => {
                acc[item.category || 'unknown'] = item.count;
                return acc;
            }, {}),
            byType: typeStats.reduce((acc, item) => {
                acc[item.reportType || 'unknown'] = item.count;
                return acc;
            }, {}),
            byPriority: priorityStats.reduce((acc, item) => {
                acc[item.priority || 'unknown'] = item.count;
                return acc;
            }, {}),
            recentActivity: recentActivity[0]?.count || 0,
        });
    }
    catch (error) {
        console.error('Get report stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Admin: Fraud alerts management
router.get('/admin/fraud-alerts', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('ADMIN'), async (req, res) => {
    try {
        const { severity, isResolved, page = 1, limit = 20 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        let whereConditions = [];
        if (severity)
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.fraudAlerts.severity, severity));
        if (isResolved !== undefined)
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.fraudAlerts.isResolved, isResolved === 'true'));
        const alerts = await database_1.default.select({
            alert: schema_1.fraudAlerts,
            user: {
                id: schema_1.users.id,
                fullName: schema_1.users.fullName,
                email: schema_1.users.email,
                role: schema_1.users.role,
            },
        })
            .from(schema_1.fraudAlerts)
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.fraudAlerts.userId, schema_1.users.id))
            .where(whereConditions.length > 0 ? (0, drizzle_orm_1.and)(...whereConditions) : undefined)
            .orderBy((0, drizzle_orm_1.desc)(schema_1.fraudAlerts.createdAt))
            .limit(Number(limit))
            .offset(offset);
        const totalCountResult = await database_1.default.select({
            count: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
        })
            .from(schema_1.fraudAlerts)
            .where(whereConditions.length > 0 ? (0, drizzle_orm_1.and)(...whereConditions) : undefined);
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
    }
    catch (error) {
        console.error('Get fraud alerts error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Admin: Resolve fraud alert
router.put('/admin/fraud-alerts/:id/resolve', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('ADMIN'), async (req, res) => {
    try {
        const alertId = req.params.id;
        const adminId = req.user.userId;
        const { resolution } = req.body;
        if (!resolution) {
            return res.status(400).json({ error: 'Resolution is required' });
        }
        const updatedAlert = await database_1.default.update(schema_1.fraudAlerts)
            .set({
            isResolved: true,
            resolvedBy: adminId,
            resolvedAt: new Date(),
            resolution,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_1.fraudAlerts.id, alertId))
            .returning();
        if (updatedAlert.length === 0) {
            return res.status(404).json({ error: 'Fraud alert not found' });
        }
        res.json({
            message: 'Fraud alert resolved successfully',
            alert: updatedAlert[0],
        });
    }
    catch (error) {
        console.error('Resolve fraud alert error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Admin: Blacklist management
router.post('/admin/blacklist', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('ADMIN'), async (req, res) => {
    try {
        const adminId = req.user.userId;
        const { entityType, entityValue, reason, expiresAt } = req.body;
        if (!entityType || !entityValue || !reason) {
            return res.status(400).json({
                error: 'Required fields: entityType, entityValue, reason'
            });
        }
        // Check if already blacklisted
        const existing = await database_1.default.select()
            .from(schema_1.blacklistedEntities)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.blacklistedEntities.entityType, entityType), (0, drizzle_orm_1.eq)(schema_1.blacklistedEntities.entityValue, entityValue), (0, drizzle_orm_1.eq)(schema_1.blacklistedEntities.isActive, true)))
            .limit(1);
        if (existing.length > 0) {
            return res.status(409).json({ error: 'Entity is already blacklisted' });
        }
        const blacklistedEntity = await database_1.default.insert(schema_1.blacklistedEntities).values({
            entityType: entityType,
            entityValue,
            reason,
            addedBy: adminId,
            expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        }).returning();
        res.status(201).json({
            message: 'Entity blacklisted successfully',
            entity: blacklistedEntity[0],
        });
    }
    catch (error) {
        console.error('Blacklist entity error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Admin: Remove from blacklist
router.delete('/admin/blacklist/:id', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('ADMIN'), async (req, res) => {
    try {
        const blacklistId = parseInt(req.params.id);
        const updated = await database_1.default.update(schema_1.blacklistedEntities)
            .set({ isActive: false, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_1.blacklistedEntities.id, blacklistId))
            .returning();
        if (updated.length === 0) {
            return res.status(404).json({ error: 'Blacklisted entity not found' });
        }
        res.json({
            message: 'Entity removed from blacklist successfully',
            entity: updated[0],
        });
    }
    catch (error) {
        console.error('Remove from blacklist error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
