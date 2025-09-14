"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeWebSocket = exports.websocketService = exports.WebSocketService = void 0;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const drizzle_orm_1 = require("drizzle-orm");
const database_1 = __importDefault(require("../config/database"));
const schema_1 = require("../schema");
const environment_1 = require("../config/environment");
class WebSocketService {
    constructor(server) {
        this.connectedUsers = new Map();
        this.io = new socket_io_1.Server(server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });
        this.setupMiddleware();
        this.setupEventHandlers();
    }
    setupMiddleware() {
        // Authentication middleware
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
                if (!token) {
                    return next(new Error('Authentication error: No token provided'));
                }
                const decoded = jsonwebtoken_1.default.verify(token, environment_1.JWT_SECRET);
                const user = await database_1.default.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, decoded.userId));
                if (user.length === 0) {
                    return next(new Error('Authentication error: User not found'));
                }
                socket.userId = decoded.userId;
                socket.userRole = decoded.role;
                next();
            }
            catch (error) {
                next(new Error('Authentication error: Invalid token'));
            }
        });
    }
    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`User ${socket.userId} connected`);
            // Store user connection
            if (socket.userId) {
                this.connectedUsers.set(socket.userId, socket.id);
            }
            // Join conversation rooms
            socket.on('join_conversation', async (conversationId) => {
                try {
                    // Verify user is participant in conversation
                    const conversation = await database_1.default.select().from(schema_1.conversations).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.conversations.id, conversationId), (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_1.conversations.customerId, socket.userId), (0, drizzle_orm_1.eq)(schema_1.conversations.vendorId, socket.userId))));
                    if (conversation.length > 0) {
                        socket.join(`conversation_${conversationId}`);
                        socket.emit('joined_conversation', { conversationId });
                    }
                    else {
                        socket.emit('error', { message: 'Not authorized to join this conversation' });
                    }
                }
                catch (error) {
                    socket.emit('error', { message: 'Failed to join conversation' });
                }
            });
            // Leave conversation room
            socket.on('leave_conversation', (conversationId) => {
                socket.leave(`conversation_${conversationId}`);
                socket.emit('left_conversation', { conversationId });
            });
            // Handle new messages
            socket.on('send_message', async (data) => {
                try {
                    const { conversationId, content, messageType = 'TEXT', attachedData } = data;
                    // Verify conversation access
                    const conversation = await database_1.default.select().from(schema_1.conversations).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.conversations.id, conversationId), (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_1.conversations.customerId, socket.userId), (0, drizzle_orm_1.eq)(schema_1.conversations.vendorId, socket.userId))));
                    if (conversation.length === 0) {
                        socket.emit('error', { message: 'Conversation not found or access denied' });
                        return;
                    }
                    if (conversation[0].status === 'CLOSED') {
                        socket.emit('error', { message: 'Cannot send message to closed conversation' });
                        return;
                    }
                    // Save message to database
                    const newMessage = await database_1.default.insert(schema_1.chatMessages).values({
                        conversationId,
                        senderId: socket.userId,
                        content,
                        messageType: messageType,
                        attachedData,
                    }).returning();
                    // Update conversation
                    await database_1.default.update(schema_1.conversations)
                        .set({
                        lastMessage: content,
                        lastMessageAt: new Date(),
                        updatedAt: new Date(),
                    })
                        .where((0, drizzle_orm_1.eq)(schema_1.conversations.id, conversationId));
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
                        .where((0, drizzle_orm_1.eq)(schema_1.chatMessages.id, newMessage[0].id));
                    // Broadcast message to conversation room
                    this.io.to(`conversation_${conversationId}`).emit('new_message', {
                        conversationId,
                        message: messageWithSender[0],
                    });
                    // Send typing stopped event
                    socket.to(`conversation_${conversationId}`).emit('user_stopped_typing', {
                        conversationId,
                        userId: socket.userId,
                    });
                }
                catch (error) {
                    console.error('Send message error:', error);
                    socket.emit('error', { message: 'Failed to send message' });
                }
            });
            // Handle typing indicators
            socket.on('typing_start', (conversationId) => {
                socket.to(`conversation_${conversationId}`).emit('user_typing', {
                    conversationId,
                    userId: socket.userId,
                });
            });
            socket.on('typing_stop', (conversationId) => {
                socket.to(`conversation_${conversationId}`).emit('user_stopped_typing', {
                    conversationId,
                    userId: socket.userId,
                });
            });
            // Handle message read status
            socket.on('mark_messages_read', async (conversationId) => {
                try {
                    await database_1.default.update(schema_1.chatMessages)
                        .set({ isRead: true })
                        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.chatMessages.conversationId, conversationId), (0, drizzle_orm_1.eq)(schema_1.chatMessages.isRead, false)));
                    socket.to(`conversation_${conversationId}`).emit('messages_read', {
                        conversationId,
                        userId: socket.userId,
                    });
                }
                catch (error) {
                    console.error('Mark messages read error:', error);
                }
            });
            // Handle user status updates
            socket.on('update_user_status', (status) => {
                socket.broadcast.emit('user_status_changed', {
                    userId: socket.userId,
                    status,
                });
            });
            // Handle disconnection
            socket.on('disconnect', () => {
                console.log(`User ${socket.userId} disconnected`);
                if (socket.userId) {
                    this.connectedUsers.delete(socket.userId);
                    // Broadcast user offline status
                    socket.broadcast.emit('user_status_changed', {
                        userId: socket.userId,
                        status: 'offline',
                    });
                }
            });
        });
    }
    // Method to send notification to specific user
    sendNotificationToUser(userId, notification) {
        const socketId = this.connectedUsers.get(userId);
        if (socketId) {
            this.io.to(socketId).emit('notification', notification);
        }
    }
    // Method to broadcast to conversation
    broadcastToConversation(conversationId, event, data) {
        this.io.to(`conversation_${conversationId}`).emit(event, data);
    }
    // Get online users
    getOnlineUsers() {
        return Array.from(this.connectedUsers.keys());
    }
    // Check if user is online
    isUserOnline(userId) {
        return this.connectedUsers.has(userId);
    }
}
exports.WebSocketService = WebSocketService;
const initializeWebSocket = (server) => {
    exports.websocketService = new WebSocketService(server);
    return exports.websocketService;
};
exports.initializeWebSocket = initializeWebSocket;
