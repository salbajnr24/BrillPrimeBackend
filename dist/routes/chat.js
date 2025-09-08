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
// Start conversation
router.post('/conversations', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const userRole = req.user.role;
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
        }
        else if (userRole === 'MERCHANT') {
            finalVendorId = userId;
            if (!customerId) {
                return res.status(400).json({ error: 'Customer ID is required' });
            }
        }
        // Check if conversation already exists
        const existingConversation = await database_1.default.select().from(schema_1.conversations).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.conversations.customerId, finalCustomerId), (0, drizzle_orm_1.eq)(schema_1.conversations.vendorId, finalVendorId), productId ? (0, drizzle_orm_1.eq)(schema_1.conversations.productId, productId) : undefined).filter(Boolean));
        if (existingConversation.length > 0) {
            return res.json({
                message: 'Conversation already exists',
                conversation: existingConversation[0],
            });
        }
        // Verify vendor and customer exist
        const [customer, vendor] = await Promise.all([
            database_1.default.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, finalCustomerId)),
            database_1.default.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, finalVendorId)),
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
            const product = await database_1.default.select().from(schema_1.products).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.products.id, productId), (0, drizzle_orm_1.eq)(schema_1.products.sellerId, finalVendorId)));
            if (product.length === 0) {
                return res.status(400).json({ error: 'Product not found or does not belong to vendor' });
            }
        }
        const conversation = await database_1.default.insert(schema_1.conversations).values({
            customerId: finalCustomerId,
            vendorId: finalVendorId,
            productId,
            conversationType: conversationType,
        }).returning();
        res.status(201).json({
            message: 'Conversation started successfully',
            conversation: conversation[0],
        });
    }
    catch (error) {
        console.error('Start conversation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get user conversations
router.get('/conversations', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const userRole = req.user.role;
        const { page = 1, limit = 20 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        let whereCondition;
        if (userRole === 'CONSUMER') {
            whereCondition = (0, drizzle_orm_1.eq)(schema_1.conversations.customerId, userId);
        }
        else if (userRole === 'MERCHANT') {
            whereCondition = (0, drizzle_orm_1.eq)(schema_1.conversations.vendorId, userId);
        }
        else {
            return res.status(403).json({ error: 'Only consumers and merchants can access conversations' });
        }
        const userConversations = await database_1.default.select({
            id: schema_1.conversations.id,
            conversationType: schema_1.conversations.conversationType,
            status: schema_1.conversations.status,
            lastMessage: schema_1.conversations.lastMessage,
            lastMessageAt: schema_1.conversations.lastMessageAt,
            createdAt: schema_1.conversations.createdAt,
            customer: {
                id: schema_1.users.id,
                fullName: schema_1.users.fullName,
                profilePicture: schema_1.users.profilePicture,
            },
            vendor: {
                id: schema_1.users.id,
                fullName: schema_1.users.fullName,
                profilePicture: schema_1.users.profilePicture,
            },
            product: {
                id: schema_1.products.id,
                name: schema_1.products.name,
                image: schema_1.products.image,
                price: schema_1.products.price,
            },
        })
            .from(schema_1.conversations)
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.conversations.customerId, schema_1.users.id))
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.conversations.vendorId, schema_1.users.id))
            .leftJoin(schema_1.products, (0, drizzle_orm_1.eq)(schema_1.conversations.productId, schema_1.products.id))
            .where(whereCondition)
            .orderBy((0, drizzle_orm_1.desc)(schema_1.conversations.lastMessageAt))
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
    }
    catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Send message
router.post('/conversations/:id/messages', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const { content, messageType = 'TEXT', attachedData } = req.body;
        if (!content) {
            return res.status(400).json({ error: 'Message content is required' });
        }
        const validMessageTypes = ['TEXT', 'QUOTE_REQUEST', 'QUOTE_RESPONSE', 'ORDER_UPDATE'];
        if (!validMessageTypes.includes(messageType)) {
            return res.status(400).json({ error: 'Invalid message type' });
        }
        // Check if conversation exists and user is participant
        const conversation = await database_1.default.select().from(schema_1.conversations).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.conversations.id, id), (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_1.conversations.customerId, userId), (0, drizzle_orm_1.eq)(schema_1.conversations.vendorId, userId))));
        if (conversation.length === 0) {
            return res.status(404).json({ error: 'Conversation not found or you are not a participant' });
        }
        if (conversation[0].status === 'CLOSED') {
            return res.status(400).json({ error: 'Cannot send message to closed conversation' });
        }
        // Send message
        const message = await database_1.default.insert(schema_1.chatMessages).values({
            conversationId: id,
            senderId: userId,
            content,
            messageType: messageType,
            attachedData,
        }).returning();
        // Update conversation with last message
        await database_1.default.update(schema_1.conversations)
            .set({
            lastMessage: content,
            lastMessageAt: new Date(),
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_1.conversations.id, id));
        // Get message with sender info
        const messageWithSender = await database_1.default.select({
            id: schema_1.chatMessages.id,
            content: schema_1.chatMessages.content,
            messageType: schema_1.chatMessages.messageType,
            attachedData: schema_1.chatMessages.attachedData,
            isRead: schema_1.chatMessages.isRead,
            createdAt: schema_1.chatMessages.createdAt,
            sender: {
                id: schema_1.users.id,
                fullName: schema_1.users.fullName,
                profilePicture: schema_1.users.profilePicture,
            },
        })
            .from(schema_1.chatMessages)
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.chatMessages.senderId, schema_1.users.id))
            .where((0, drizzle_orm_1.eq)(schema_1.chatMessages.id, message[0].id));
        res.status(201).json({
            message: 'Message sent successfully',
            chatMessage: messageWithSender[0],
        });
    }
    catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get conversation messages
router.get('/conversations/:id/messages', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const { page = 1, limit = 50 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        // Check if user is participant in conversation
        const conversation = await database_1.default.select().from(schema_1.conversations).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.conversations.id, id), (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_1.conversations.customerId, userId), (0, drizzle_orm_1.eq)(schema_1.conversations.vendorId, userId))));
        if (conversation.length === 0) {
            return res.status(404).json({ error: 'Conversation not found or you are not a participant' });
        }
        const messages = await database_1.default.select({
            id: schema_1.chatMessages.id,
            content: schema_1.chatMessages.content,
            messageType: schema_1.chatMessages.messageType,
            attachedData: schema_1.chatMessages.attachedData,
            isRead: schema_1.chatMessages.isRead,
            createdAt: schema_1.chatMessages.createdAt,
            sender: {
                id: schema_1.users.id,
                fullName: schema_1.users.fullName,
                profilePicture: schema_1.users.profilePicture,
            },
        })
            .from(schema_1.chatMessages)
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.chatMessages.senderId, schema_1.users.id))
            .where((0, drizzle_orm_1.eq)(schema_1.chatMessages.conversationId, id))
            .orderBy(schema_1.chatMessages.createdAt)
            .limit(Number(limit))
            .offset(offset);
        // Mark messages as read for the current user
        await database_1.default.update(schema_1.chatMessages)
            .set({ isRead: true })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.chatMessages.conversationId, id), (0, drizzle_orm_1.eq)(schema_1.chatMessages.isRead, false)));
        res.json({
            messages,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: messages.length,
            },
        });
    }
    catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get conversation details
router.get('/conversations/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const conversation = await database_1.default.select({
            id: schema_1.conversations.id,
            conversationType: schema_1.conversations.conversationType,
            status: schema_1.conversations.status,
            lastMessage: schema_1.conversations.lastMessage,
            lastMessageAt: schema_1.conversations.lastMessageAt,
            createdAt: schema_1.conversations.createdAt,
            customer: {
                id: schema_1.users.id,
                fullName: schema_1.users.fullName,
                profilePicture: schema_1.users.profilePicture,
                phone: schema_1.users.phone,
            },
            vendor: {
                id: schema_1.users.id,
                fullName: schema_1.users.fullName,
                profilePicture: schema_1.users.profilePicture,
                phone: schema_1.users.phone,
            },
            product: {
                id: schema_1.products.id,
                name: schema_1.products.name,
                image: schema_1.products.image,
                price: schema_1.products.price,
                description: schema_1.products.description,
            },
        })
            .from(schema_1.conversations)
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.conversations.customerId, schema_1.users.id))
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.conversations.vendorId, schema_1.users.id))
            .leftJoin(schema_1.products, (0, drizzle_orm_1.eq)(schema_1.conversations.productId, schema_1.products.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.conversations.id, id), (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_1.conversations.customerId, userId), (0, drizzle_orm_1.eq)(schema_1.conversations.vendorId, userId))));
        if (conversation.length === 0) {
            return res.status(404).json({ error: 'Conversation not found or you are not a participant' });
        }
        res.json(conversation[0]);
    }
    catch (error) {
        console.error('Get conversation details error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Close conversation
router.put('/conversations/:id/close', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        // Check if user is participant in conversation
        const conversation = await database_1.default.select().from(schema_1.conversations).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.conversations.id, id), (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_1.conversations.customerId, userId), (0, drizzle_orm_1.eq)(schema_1.conversations.vendorId, userId))));
        if (conversation.length === 0) {
            return res.status(404).json({ error: 'Conversation not found or you are not a participant' });
        }
        const updatedConversation = await database_1.default.update(schema_1.conversations)
            .set({
            status: 'CLOSED',
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_1.conversations.id, id))
            .returning();
        res.json({
            message: 'Conversation closed successfully',
            conversation: updatedConversation[0],
        });
    }
    catch (error) {
        console.error('Close conversation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=chat.js.map