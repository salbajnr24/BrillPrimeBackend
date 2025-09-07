import { Router } from 'express';
import { eq, and, desc, sql, or } from 'drizzle-orm';
import db from '../config/database';
import { supportTickets, users } from '../schema';
import { authenticateToken, authorizeRoles } from '../utils/auth';

const router = Router();

// Create support ticket
router.post('/tickets', async (req, res) => {
  try {
    const {
      name,
      email,
      subject,
      message,
      priority = 'NORMAL',
    } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'Required fields: name, email, subject, message' });
    }

    // Generate ticket number
    const ticketNumber = `BP-SUPPORT-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    // Determine user info if authenticated
    let userId = null;
    let userRole = 'GUEST';

    if ((req as any).user) {
      userId = (req as any).user.userId;
      userRole = (req as any).user.role;
    }

    const ticket = await db.insert(supportTickets).values({
      ticketNumber,
      userId,
      userRole: userRole as any,
      name,
      email,
      subject,
      message,
      priority: priority as any,
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
  } catch (error) {
    console.error('Create support ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's support tickets
router.get('/tickets', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereConditions = [eq(supportTickets.userId, userId)];

    if (status) {
      whereConditions.push(eq(supportTickets.status, status as any));
    }

    const tickets = await db.select({
      id: supportTickets.id,
      ticketNumber: supportTickets.ticketNumber,
      subject: supportTickets.subject,
      status: supportTickets.status,
      priority: supportTickets.priority,
      createdAt: supportTickets.createdAt,
      updatedAt: supportTickets.updatedAt,
      resolvedAt: supportTickets.resolvedAt,
    })
      .from(supportTickets)
      .where(and(...whereConditions))
      .orderBy(desc(supportTickets.createdAt))
      .limit(Number(limit))
      .offset(offset);

    // Get total count
    const totalCountResult = await db.select({
      count: sql<number>`count(*)`.mapWith(Number),
    })
      .from(supportTickets)
      .where(and(...whereConditions));

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
  } catch (error) {
    console.error('Get user tickets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific ticket details
router.get('/tickets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let whereConditions = [eq(supportTickets.id, id)];

    // If user is authenticated, only show their tickets or allow admin access
    if ((req as any).user) {
      const userId = (req as any).user.userId;
      const userRole = (req as any).user.role;
      
      if (userRole !== 'ADMIN') {
        whereConditions.push(eq(supportTickets.userId, userId));
      }
    } else {
      // For guest access, we need to verify ownership differently
      // This is a simplified approach - in production, you might want to use tokens
      const { email } = req.query;
      if (email) {
        whereConditions.push(eq(supportTickets.email, email as string));
      } else {
        return res.status(401).json({ error: 'Authentication required or email parameter needed' });
      }
    }

    const ticket = await db.select({
      ticket: supportTickets,
      assignedToUser: {
        id: users.id,
        fullName: users.fullName,
        email: users.email,
      },
    })
      .from(supportTickets)
      .leftJoin(users, eq(supportTickets.assignedTo, users.id))
      .where(and(...whereConditions));

    if (ticket.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json(ticket[0]);
  } catch (error) {
    console.error('Get ticket details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update ticket (for admin/support staff)
router.put('/tickets/:id', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      status,
      priority,
      assignedTo,
      adminNotes,
      resolution,
    } = req.body;

    // Check if ticket exists
    const existingTicket = await db.select()
      .from(supportTickets)
      .where(eq(supportTickets.id, id));

    if (existingTicket.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (assignedTo) updateData.assignedTo = assignedTo;
    if (adminNotes) updateData.adminNotes = adminNotes;
    if (resolution) updateData.resolution = resolution;

    // If marking as resolved, set resolved timestamp
    if (status === 'RESOLVED' || status === 'CLOSED') {
      updateData.resolvedAt = new Date();
    }

    const updatedTicket = await db.update(supportTickets)
      .set(updateData)
      .where(eq(supportTickets.id, id))
      .returning();

    res.json({
      message: 'Ticket updated successfully',
      ticket: updatedTicket[0],
    });
  } catch (error) {
    console.error('Update ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all tickets (admin only)
router.get('/admin/tickets', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { status, priority, userRole, assignedTo, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereConditions: any[] = [];

    if (status) {
      whereConditions.push(eq(supportTickets.status, status as any));
    }
    if (priority) {
      whereConditions.push(eq(supportTickets.priority, priority as any));
    }
    if (userRole) {
      whereConditions.push(eq(supportTickets.userRole, userRole as any));
    }
    if (assignedTo) {
      whereConditions.push(eq(supportTickets.assignedTo, Number(assignedTo)));
    }

    const tickets = await db.select({
      ticket: supportTickets,
      user: {
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
      },
      assignedToUser: {
        id: users.id,
        fullName: users.fullName,
        email: users.email,
      },
    })
      .from(supportTickets)
      .leftJoin(users, eq(supportTickets.userId, users.id))
      .leftJoin(users, eq(supportTickets.assignedTo, users.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(supportTickets.createdAt))
      .limit(Number(limit))
      .offset(offset);

    // Get total count
    const totalCountResult = await db.select({
      count: sql<number>`count(*)`.mapWith(Number),
    })
      .from(supportTickets)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

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
  } catch (error) {
    console.error('Get admin tickets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get ticket statistics (admin only)
router.get('/admin/stats', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const stats = await db.select({
      status: supportTickets.status,
      count: sql<number>`count(*)`.mapWith(Number),
    })
      .from(supportTickets)
      .groupBy(supportTickets.status);

    const priorityStats = await db.select({
      priority: supportTickets.priority,
      count: sql<number>`count(*)`.mapWith(Number),
    })
      .from(supportTickets)
      .groupBy(supportTickets.priority);

    const userRoleStats = await db.select({
      userRole: supportTickets.userRole,
      count: sql<number>`count(*)`.mapWith(Number),
    })
      .from(supportTickets)
      .groupBy(supportTickets.userRole);

    res.json({
      byStatus: stats.reduce((acc, item) => {
        acc[item.status || 'unknown'] = item.count;
        return acc;
      }, {} as Record<string, number>),
      byPriority: priorityStats.reduce((acc, item) => {
        acc[item.priority || 'unknown'] = item.count;
        return acc;
      }, {} as Record<string, number>),
      byUserRole: userRoleStats.reduce((acc, item) => {
        acc[item.userRole || 'unknown'] = item.count;
        return acc;
      }, {} as Record<string, number>),
    });
  } catch (error) {
    console.error('Get support stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;