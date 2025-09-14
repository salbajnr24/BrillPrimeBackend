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
// Create support ticket
router.post('/tickets', async (req, res) => {
    try {
        const { name, email, subject, message, priority = 'NORMAL', } = req.body;
        if (!name || !email || !subject || !message) {
            return res.status(400).json({ error: 'Required fields: name, email, subject, message' });
        }
        // Generate ticket number
        const ticketNumber = `BP-SUPPORT-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        // Determine user info if authenticated
        let userId = null;
        let userRole = 'GUEST';
        if (req.user) {
            userId = req.user.userId;
            userRole = req.user.role;
        }
        const ticket = await database_1.default.insert(schema_1.supportTickets).values({
            ticketNumber,
            userId,
            userRole: userRole,
            name,
            email,
            subject,
            message,
            priority: priority,
        }).returning();
        res.status(201).json({
            message: 'Support ticket created successfully',
            ticket: {
                id: ticket[0].id,
                ticketNumber: ticket[0].ticketNumber,
                subject: ticket[0].subject,
                status: ticket[0].status,
                priority: ticket[0].priority,
                createdAt: ticket[0].createdAt,
            },
        });
    }
    catch (error) {
        console.error('Create support ticket error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get user's support tickets
router.get('/tickets', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { status, page = 1, limit = 10 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        let whereConditions = [(0, drizzle_orm_1.eq)(schema_1.supportTickets.userId, userId)];
        if (status) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.supportTickets.status, status));
        }
        const tickets = await database_1.default.select({
            id: schema_1.supportTickets.id,
            ticketNumber: schema_1.supportTickets.ticketNumber,
            subject: schema_1.supportTickets.subject,
            status: schema_1.supportTickets.status,
            priority: schema_1.supportTickets.priority,
            createdAt: schema_1.supportTickets.createdAt,
            updatedAt: schema_1.supportTickets.updatedAt,
            resolvedAt: schema_1.supportTickets.resolvedAt,
        })
            .from(schema_1.supportTickets)
            .where((0, drizzle_orm_1.and)(...whereConditions))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.supportTickets.createdAt))
            .limit(Number(limit))
            .offset(offset);
        // Get total count
        const totalCountResult = await database_1.default.select({
            count: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
        })
            .from(schema_1.supportTickets)
            .where((0, drizzle_orm_1.and)(...whereConditions));
        const totalCount = totalCountResult[0]?.count || 0;
        res.json({
            tickets,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: totalCount,
                totalPages: Math.ceil(totalCount / Number(limit)),
            },
        });
    }
    catch (error) {
        console.error('Get user tickets error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get specific ticket details
router.get('/tickets/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let whereConditions = [(0, drizzle_orm_1.eq)(schema_1.supportTickets.id, id)];
        // If user is authenticated, only show their tickets or allow admin access
        if (req.user) {
            const userId = req.user.userId;
            const userRole = req.user.role;
            if (userRole !== 'ADMIN') {
                whereConditions.push((0, drizzle_orm_1.eq)(schema_1.supportTickets.userId, userId));
            }
        }
        else {
            // For guest access, we need to verify ownership differently
            // This is a simplified approach - in production, you might want to use tokens
            const { email } = req.query;
            if (email) {
                whereConditions.push((0, drizzle_orm_1.eq)(schema_1.supportTickets.email, email));
            }
            else {
                return res.status(401).json({ error: 'Authentication required or email parameter needed' });
            }
        }
        const ticket = await database_1.default.select({
            ticket: schema_1.supportTickets,
            assignedToUser: {
                id: schema_1.users.id,
                fullName: schema_1.users.fullName,
                email: schema_1.users.email,
            },
        })
            .from(schema_1.supportTickets)
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.supportTickets.assignedTo, schema_1.users.id))
            .where((0, drizzle_orm_1.and)(...whereConditions));
        if (ticket.length === 0) {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        res.json(ticket[0]);
    }
    catch (error) {
        console.error('Get ticket details error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Update ticket (for admin/support staff)
router.put('/tickets/:id', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;
        const { status, priority, assignedTo, adminNotes, resolution, } = req.body;
        // Check if ticket exists
        const existingTicket = await database_1.default.select()
            .from(schema_1.supportTickets)
            .where((0, drizzle_orm_1.eq)(schema_1.supportTickets.id, id));
        if (existingTicket.length === 0) {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        const updateData = {
            updatedAt: new Date(),
        };
        if (status)
            updateData.status = status;
        if (priority)
            updateData.priority = priority;
        if (assignedTo)
            updateData.assignedTo = assignedTo;
        if (adminNotes)
            updateData.adminNotes = adminNotes;
        if (resolution)
            updateData.resolution = resolution;
        // If marking as resolved, set resolved timestamp
        if (status === 'RESOLVED' || status === 'CLOSED') {
            updateData.resolvedAt = new Date();
        }
        const updatedTicket = await database_1.default.update(schema_1.supportTickets)
            .set(updateData)
            .where((0, drizzle_orm_1.eq)(schema_1.supportTickets.id, id))
            .returning();
        res.json({
            message: 'Ticket updated successfully',
            ticket: updatedTicket[0],
        });
    }
    catch (error) {
        console.error('Update ticket error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get all tickets (admin only)
router.get('/admin/tickets', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('ADMIN'), async (req, res) => {
    try {
        const { status, priority, userRole, assignedTo, page = 1, limit = 20 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        let whereConditions = [];
        if (status) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.supportTickets.status, status));
        }
        if (priority) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.supportTickets.priority, priority));
        }
        if (userRole) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.supportTickets.userRole, userRole));
        }
        if (assignedTo) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.supportTickets.assignedTo, Number(assignedTo)));
        }
        const tickets = await database_1.default.select({
            ticket: schema_1.supportTickets,
            user: {
                id: schema_1.users.id,
                fullName: schema_1.users.fullName,
                email: schema_1.users.email,
                role: schema_1.users.role,
            },
            assignedToUser: {
                id: schema_1.users.id,
                fullName: schema_1.users.fullName,
                email: schema_1.users.email,
            },
        })
            .from(schema_1.supportTickets)
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.supportTickets.userId, schema_1.users.id))
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.supportTickets.assignedTo, schema_1.users.id))
            .where(whereConditions.length > 0 ? (0, drizzle_orm_1.and)(...whereConditions) : undefined)
            .orderBy((0, drizzle_orm_1.desc)(schema_1.supportTickets.createdAt))
            .limit(Number(limit))
            .offset(offset);
        // Get total count
        const totalCountResult = await database_1.default.select({
            count: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
        })
            .from(schema_1.supportTickets)
            .where(whereConditions.length > 0 ? (0, drizzle_orm_1.and)(...whereConditions) : undefined);
        const totalCount = totalCountResult[0]?.count || 0;
        res.json({
            tickets,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: totalCount,
                totalPages: Math.ceil(totalCount / Number(limit)),
            },
        });
    }
    catch (error) {
        console.error('Get admin tickets error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get ticket statistics (admin only)
router.get('/admin/stats', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('ADMIN'), async (req, res) => {
    try {
        const stats = await database_1.default.select({
            status: schema_1.supportTickets.status,
            count: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
        })
            .from(schema_1.supportTickets)
            .groupBy(schema_1.supportTickets.status);
        const priorityStats = await database_1.default.select({
            priority: schema_1.supportTickets.priority,
            count: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
        })
            .from(schema_1.supportTickets)
            .groupBy(schema_1.supportTickets.priority);
        const userRoleStats = await database_1.default.select({
            userRole: schema_1.supportTickets.userRole,
            count: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
        })
            .from(schema_1.supportTickets)
            .groupBy(schema_1.supportTickets.userRole);
        res.json({
            byStatus: stats.reduce((acc, item) => {
                acc[item.status || 'unknown'] = item.count;
                return acc;
            }, {}),
            byPriority: priorityStats.reduce((acc, item) => {
                acc[item.priority || 'unknown'] = item.count;
                return acc;
            }, {}),
            byUserRole: userRoleStats.reduce((acc, item) => {
                acc[item.userRole || 'unknown'] = item.count;
                return acc;
            }, {}),
        });
    }
    catch (error) {
        console.error('Get support stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
