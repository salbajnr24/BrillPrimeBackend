
import { Router } from 'express';
import { eq, and, or, desc } from 'drizzle-orm';
import db from '../config/database';
import { users, conversations, chatMessages, supportTickets } from '../schema';
import { authenticateToken, authorizeRoles } from '../utils/auth';

const router = Router();

// Start a new conversation
router.post('/conversations', authenticateToken, async (req, res) => {
  try {
    const { subject, message, priority = 'MEDIUM' } = req.body;
    const userId = (req as any).user.id;

    if (!subject || !message) {
      return res.status(400).json({ success: false, message: 'Subject and message are required' });
    }

    // Create conversation
    const conversation = await db.insert(conversations).values({
      customerId: userId,
      subject,
      status: 'ACTIVE',
      priority,
      lastMessage: message,
      lastMessageAt: new Date(),
      createdAt: new Date()
    }).returning();

    // Create initial message
    await db.insert(chatMessages).values({
      conversationId: conversation[0].id,
      senderId: userId,
      content: message,
      messageType: 'TEXT',
      createdAt: new Date()
    });

    res.json({
      success: true,
      data: conversation[0],
      message: 'Conversation started successfully'
    });
  } catch (error) {
    console.error('Start conversation error:', error);
    res.status(500).json({ success: false, message: 'Failed to start conversation' });
  }
});

// Get user conversations
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { status = 'all', limit = 20 } = req.query;

    let whereCondition = eq(conversations.customerId, userId);
    
    if (status !== 'all') {
      whereCondition = and(whereCondition, eq(conversations.status, status as string));
    }

    const userConversations = await db.select({
      id: conversations.id,
      subject: conversations.subject,
      status: conversations.status,
      priority: conversations.priority,
      lastMessage: conversations.lastMessage,
      lastMessageAt: conversations.lastMessageAt,
      createdAt: conversations.createdAt,
      assignedTo: conversations.assignedTo
    })
    .from(conversations)
    .where(whereCondition)
    .limit(parseInt(limit as string))
    .orderBy(desc(conversations.lastMessageAt));

    res.json({
      success: true,
      data: userConversations
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ success: false, message: 'Failed to get conversations' });
  }
});

// Get conversation messages
router.get('/conversations/:id/messages', authenticateToken, async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id);
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    // Check if user has access to this conversation
    if (userRole !== 'ADMIN') {
      const conversation = await db.select()
        .from(conversations)
        .where(and(eq(conversations.id, conversationId), eq(conversations.customerId, userId)))
        .limit(1);

      if (conversation.length === 0) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    const messages = await db.select({
      id: chatMessages.id,
      content: chatMessages.content,
      messageType: chatMessages.messageType,
      createdAt: chatMessages.createdAt,
      sender: {
        id: users.id,
        fullName: users.fullName,
        role: users.role
      }
    })
    .from(chatMessages)
    .leftJoin(users, eq(chatMessages.senderId, users.id))
    .where(eq(chatMessages.conversationId, conversationId))
    .orderBy(chatMessages.createdAt);

    res.json({
      success: true,
      data: messages
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, message: 'Failed to get messages' });
  }
});

// Send message
router.post('/conversations/:id/messages', authenticateToken, async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id);
    const { content, messageType = 'TEXT' } = req.body;
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    if (!content) {
      return res.status(400).json({ success: false, message: 'Message content is required' });
    }

    // Check if user has access to this conversation
    if (userRole !== 'ADMIN') {
      const conversation = await db.select()
        .from(conversations)
        .where(and(eq(conversations.id, conversationId), eq(conversations.customerId, userId)))
        .limit(1);

      if (conversation.length === 0) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    // Create message
    const message = await db.insert(chatMessages).values({
      conversationId,
      senderId: userId,
      content,
      messageType,
      createdAt: new Date()
    }).returning();

    // Update conversation
    await db.update(conversations).set({
      lastMessage: content,
      lastMessageAt: new Date(),
      status: userRole === 'ADMIN' ? 'IN_PROGRESS' : 'ACTIVE'
    }).where(eq(conversations.id, conversationId));

    res.json({
      success: true,
      data: message[0],
      message: 'Message sent successfully'
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
});

// Admin: Get all active conversations
router.get('/admin/conversations', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { status = 'ACTIVE', priority = 'all', limit = 50 } = req.query;

    let whereConditions = [];
    
    if (status !== 'all') {
      whereConditions.push(eq(conversations.status, status as string));
    }
    
    if (priority !== 'all') {
      whereConditions.push(eq(conversations.priority, priority as string));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const activeConversations = await db.select({
      id: conversations.id,
      subject: conversations.subject,
      status: conversations.status,
      priority: conversations.priority,
      lastMessage: conversations.lastMessage,
      lastMessageAt: conversations.lastMessageAt,
      createdAt: conversations.createdAt,
      assignedTo: conversations.assignedTo,
      customer: {
        id: users.id,
        fullName: users.fullName,
        email: users.email
      }
    })
    .from(conversations)
    .leftJoin(users, eq(conversations.customerId, users.id))
    .where(whereClause)
    .limit(parseInt(limit as string))
    .orderBy(desc(conversations.lastMessageAt));

    res.json({
      success: true,
      data: activeConversations
    });
  } catch (error) {
    console.error('Get admin conversations error:', error);
    res.status(500).json({ success: false, message: 'Failed to get conversations' });
  }
});

// Admin: Assign conversation to agent
router.post('/admin/conversations/:id/assign', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id);
    const { agentId } = req.body;
    const adminId = (req as any).user.id;

    await db.update(conversations).set({
      assignedTo: agentId || adminId,
      status: 'IN_PROGRESS',
      updatedAt: new Date()
    }).where(eq(conversations.id, conversationId));

    res.json({
      success: true,
      message: 'Conversation assigned successfully'
    });
  } catch (error) {
    console.error('Assign conversation error:', error);
    res.status(500).json({ success: false, message: 'Failed to assign conversation' });
  }
});

// Admin: Close conversation
router.post('/admin/conversations/:id/close', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id);
    const { resolution } = req.body;

    await db.update(conversations).set({
      status: 'CLOSED',
      resolution: resolution || 'Resolved by admin',
      closedAt: new Date(),
      updatedAt: new Date()
    }).where(eq(conversations.id, conversationId));

    res.json({
      success: true,
      message: 'Conversation closed successfully'
    });
  } catch (error) {
    console.error('Close conversation error:', error);
    res.status(500).json({ success: false, message: 'Failed to close conversation' });
  }
});

// Get chat statistics
router.get('/admin/stats', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      activeConversations,
      todayConversations,
      pendingConversations,
      closedToday
    ] = await Promise.all([
      db.select({ count: conversations.id }).from(conversations).where(eq(conversations.status, 'ACTIVE')),
      db.select({ count: conversations.id }).from(conversations).where(and(
        eq(conversations.status, 'ACTIVE'),
        or(eq(conversations.createdAt, today))
      )),
      db.select({ count: conversations.id }).from(conversations).where(eq(conversations.status, 'PENDING')),
      db.select({ count: conversations.id }).from(conversations).where(and(
        eq(conversations.status, 'CLOSED'),
        or(eq(conversations.closedAt, today))
      ))
    ]);

    const stats = {
      activeConversations: activeConversations.length,
      todayConversations: todayConversations.length,
      pendingConversations: pendingConversations.length,
      closedToday: closedToday.length,
      avgResponseTime: 15, // Mock - would be calculated from actual data
      satisfactionRate: 4.5 // Mock - would come from customer feedback
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get chat stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to get chat statistics' });
  }
});

export default router;
