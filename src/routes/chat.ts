import { Router } from 'express';
import { eq, and, desc, or } from 'drizzle-orm';
import db from '../config/database';
import { conversations, chatMessages, users, products } from '../schema';
import { authenticateToken } from '../utils/auth';
import { websocketService } from '../utils/websocket';

const router = Router();

// Start conversation
router.post('/conversations', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const userRole = (req as any).user.role;
    const { customerId, vendorId, productId, conversationType } = req.body;

    if (!conversationType || !['QUOTE', 'ORDER', 'GENERAL'].includes(conversationType)) {
      return res.status(400).json({ error: 'Valid conversation type is required (QUOTE, ORDER, GENERAL)' });
    }

    let finalCustomerId = customerId;
    let finalVendorId = vendorId;

    // Auto-assign based on user role
    if (userRole === 'CONSUMER') {
      finalCustomerId = userId;
      if (!vendorId) {
        return res.status(400).json({ error: 'Vendor ID is required' });
      }
    } else if (userRole === 'MERCHANT') {
      finalVendorId = userId;
      if (!customerId) {
        return res.status(400).json({ error: 'Customer ID is required' });
      }
    }

    // Check if conversation already exists
    const existingConversation = await db.select().from(conversations).where(and(
      eq(conversations.customerId, finalCustomerId),
      eq(conversations.vendorId, finalVendorId),
      productId ? eq(conversations.productId, productId) : undefined
    ));

    if (existingConversation.length > 0) {
      return res.json({
        message: 'Conversation already exists',
        conversation: existingConversation[0],
      });
    }

    // Verify vendor and customer exist
    const [customer, vendor] = await Promise.all([
      db.select().from(users).where(eq(users.id, finalCustomerId)),
      db.select().from(users).where(eq(users.id, finalVendorId)),
    ]);

    if (customer.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    if (vendor.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    if (vendor[0].role !== 'MERCHANT') {
      return res.status(400).json({ error: 'User is not a merchant' });
    }

    // Verify product if provided
    if (productId) {
      const product = await db.select().from(products).where(and(
        eq(products.id, productId),
        eq(products.sellerId, finalVendorId)
      ));

      if (product.length === 0) {
        return res.status(400).json({ error: 'Product not found or does not belong to vendor' });
      }
    }

    const conversation = await db.insert(conversations).values({
      customerId: finalCustomerId,
      vendorId: finalVendorId,
      productId,
      conversationType: conversationType as any,
    }).returning();

    // Notify other participant about new conversation
    const otherParticipantId = userRole === 'CONSUMER' ? finalVendorId : finalCustomerId;
    if (websocketService && websocketService.isUserOnline(otherParticipantId)) {
      websocketService.sendNotificationToUser(otherParticipantId, {
        type: 'NEW_CONVERSATION',
        conversationId: conversation[0].id,
        message: 'New conversation started',
      });
    }

    res.status(201).json({
      message: 'Conversation started successfully',
      conversation: conversation[0],
    });
  } catch (error) {
    console.error('Start conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user conversations
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const userRole = (req as any).user.role;
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereCondition;
    if (userRole === 'CONSUMER') {
      whereCondition = eq(conversations.customerId, userId);
    } else if (userRole === 'MERCHANT') {
      whereCondition = eq(conversations.vendorId, userId);
    } else {
      return res.status(403).json({ error: 'Only consumers and merchants can access conversations' });
    }

    const userConversations = await db.select({
      id: conversations.id,
      conversationType: conversations.conversationType,
      status: conversations.status,
      lastMessage: conversations.lastMessage,
      lastMessageAt: conversations.lastMessageAt,
      createdAt: conversations.createdAt,
      customer: {
        id: users.id,
        fullName: users.fullName,
        profilePicture: users.profilePicture,
      },
      vendor: {
        id: users.id,
        fullName: users.fullName,
        profilePicture: users.profilePicture,
      },
      product: {
        id: products.id,
        name: products.name,
        image: products.image,
        price: products.price,
      },
    })
      .from(conversations)
      .leftJoin(users, eq(conversations.customerId, users.id))
      .leftJoin(users, eq(conversations.vendorId, users.id))
      .leftJoin(products, eq(conversations.productId, products.id))
      .where(whereCondition)
      .orderBy(desc(conversations.lastMessageAt))
      .limit(Number(limit))
      .offset(offset);

    res.json({
      conversations: userConversations,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: userConversations.length,
      },
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send message
router.post('/conversations/:id/messages', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    const { content, messageType = 'TEXT', attachedData } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const validMessageTypes = ['TEXT', 'QUOTE_REQUEST', 'QUOTE_RESPONSE', 'ORDER_UPDATE'];
    if (!validMessageTypes.includes(messageType)) {
      return res.status(400).json({ error: 'Invalid message type' });
    }

    // Check if conversation exists and user is participant
    const conversation = await db.select().from(conversations).where(and(
      eq(conversations.id, id),
      or(
        eq(conversations.customerId, userId),
        eq(conversations.vendorId, userId)
      )
    ));

    if (conversation.length === 0) {
      return res.status(404).json({ error: 'Conversation not found or you are not a participant' });
    }

    if (conversation[0].status === 'CLOSED') {
      return res.status(400).json({ error: 'Cannot send message to closed conversation' });
    }

    // Send message
    const message = await db.insert(chatMessages).values({
      conversationId: id,
      senderId: userId,
      content,
      messageType: messageType as any,
      attachedData,
    }).returning();

    // Update conversation with last message
    await db.update(conversations)
      .set({
        lastMessage: content,
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, id));

    // Get message with sender info
    const messageWithSender = await db.select({
      id: chatMessages.id,
      content: chatMessages.content,
      messageType: chatMessages.messageType,
      attachedData: chatMessages.attachedData,
      isRead: chatMessages.isRead,
      createdAt: chatMessages.createdAt,
      sender: {
        id: users.id,
        fullName: users.fullName,
        profilePicture: users.profilePicture,
      },
    })
      .from(chatMessages)
      .leftJoin(users, eq(chatMessages.senderId, users.id))
      .where(eq(chatMessages.id, message[0].id));

    res.status(201).json({
      message: 'Message sent successfully',
      chatMessage: messageWithSender[0],
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get conversation messages
router.get('/conversations/:id/messages', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    const { page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Check if user is participant in conversation
    const conversation = await db.select().from(conversations).where(and(
      eq(conversations.id, id),
      or(
        eq(conversations.customerId, userId),
        eq(conversations.vendorId, userId)
      )
    ));

    if (conversation.length === 0) {
      return res.status(404).json({ error: 'Conversation not found or you are not a participant' });
    }

    const messages = await db.select({
      id: chatMessages.id,
      content: chatMessages.content,
      messageType: chatMessages.messageType,
      attachedData: chatMessages.attachedData,
      isRead: chatMessages.isRead,
      createdAt: chatMessages.createdAt,
      sender: {
        id: users.id,
        fullName: users.fullName,
        profilePicture: users.profilePicture,
      },
    })
      .from(chatMessages)
      .leftJoin(users, eq(chatMessages.senderId, users.id))
      .where(eq(chatMessages.conversationId, id))
      .orderBy(chatMessages.createdAt)
      .limit(Number(limit))
      .offset(offset);

    // Mark messages as read for the current user
    await db.update(chatMessages)
      .set({ isRead: true })
      .where(and(
        eq(chatMessages.conversationId, id),
        eq(chatMessages.isRead, false)
      ));

    res.json({
      messages,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: messages.length,
      },
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get conversation details
router.get('/conversations/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    const conversation = await db.select({
      id: conversations.id,
      conversationType: conversations.conversationType,
      status: conversations.status,
      lastMessage: conversations.lastMessage,
      lastMessageAt: conversations.lastMessageAt,
      createdAt: conversations.createdAt,
      customer: {
        id: users.id,
        fullName: users.fullName,
        profilePicture: users.profilePicture,
        phone: users.phone,
      },
      vendor: {
        id: users.id,
        fullName: users.fullName,
        profilePicture: users.profilePicture,
        phone: users.phone,
      },
      product: {
        id: products.id,
        name: products.name,
        image: products.image,
        price: products.price,
        description: products.description,
      },
    })
      .from(conversations)
      .leftJoin(users, eq(conversations.customerId, users.id))
      .leftJoin(users, eq(conversations.vendorId, users.id))
      .leftJoin(products, eq(conversations.productId, products.id))
      .where(and(
        eq(conversations.id, id),
        or(
          eq(conversations.customerId, userId),
          eq(conversations.vendorId, userId)
        )
      ));

    if (conversation.length === 0) {
      return res.status(404).json({ error: 'Conversation not found or you are not a participant' });
    }

    res.json(conversation[0]);
  } catch (error) {
    console.error('Get conversation details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get online users in conversation
router.get('/conversations/:id/online-users', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    // Check if user is participant in conversation
    const conversation = await db.select().from(conversations).where(and(
      eq(conversations.id, id),
      or(
        eq(conversations.customerId, userId),
        eq(conversations.vendorId, userId)
      )
    ));

    if (conversation.length === 0) {
      return res.status(404).json({ error: 'Conversation not found or you are not a participant' });
    }

    const onlineUsers = websocketService ? websocketService.getOnlineUsers() : [];
    const conversationParticipants = [conversation[0].customerId, conversation[0].vendorId];
    const onlineParticipants = conversationParticipants.filter(participantId => 
      onlineUsers.includes(participantId)
    );

    res.json({
      onlineParticipants,
      totalOnlineUsers: onlineUsers.length,
    });
  } catch (error) {
    console.error('Get online users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's online status
router.get('/users/:userId/status', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const isOnline = websocketService ? websocketService.isUserOnline(parseInt(userId)) : false;
    
    res.json({
      userId: parseInt(userId),
      isOnline,
      lastSeen: isOnline ? null : new Date(), // In production, you'd store actual last seen
    });
  } catch (error) {
    console.error('Get user status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Close conversation
router.put('/conversations/:id/close', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    // Check if user is participant in conversation
    const conversation = await db.select().from(conversations).where(and(
      eq(conversations.id, id),
      or(
        eq(conversations.customerId, userId),
        eq(conversations.vendorId, userId)
      )
    ));

    if (conversation.length === 0) {
      return res.status(404).json({ error: 'Conversation not found or you are not a participant' });
    }

    const updatedConversation = await db.update(conversations)
      .set({
        status: 'CLOSED',
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, id))
      .returning();

    res.json({
      message: 'Conversation closed successfully',
      conversation: updatedConversation[0],
    });
  } catch (error) {
    console.error('Close conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;