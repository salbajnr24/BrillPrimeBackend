
import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { eq, and, or } from 'drizzle-orm';
import db from '../config/database';
import { conversations, chatMessages, users } from '../schema';
import { JWT_SECRET_KEY } from '../config/environment';

interface AuthenticatedSocket extends Socket {
  userId?: number;
  userRole?: string;
}

export class WebSocketService {
  private io: SocketIOServer;
  private connectedUsers: Map<number, string> = new Map();

  constructor(server: Server) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
        
        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }

        const decoded = jwt.verify(token, JWT_SECRET_KEY) as any;
        const user = await db.select().from(users).where(eq(users.id, decoded.userId));
        
        if (user.length === 0) {
          return next(new Error('Authentication error: User not found'));
        }

        socket.userId = decoded.userId;
        socket.userRole = decoded.role;
        next();
      } catch (error) {
        next(new Error('Authentication error: Invalid token'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`User ${socket.userId} connected`);
      
      // Store user connection
      if (socket.userId) {
        this.connectedUsers.set(socket.userId, socket.id);
      }

      // Join conversation rooms
      socket.on('join_conversation', async (conversationId: string) => {
        try {
          // Verify user is participant in conversation
          const conversation = await db.select().from(conversations).where(and(
            eq(conversations.id, conversationId),
            or(
              eq(conversations.customerId, socket.userId!),
              eq(conversations.vendorId, socket.userId!)
            )
          ));

          if (conversation.length > 0) {
            socket.join(`conversation_${conversationId}`);
            socket.emit('joined_conversation', { conversationId });
          } else {
            socket.emit('error', { message: 'Not authorized to join this conversation' });
          }
        } catch (error) {
          socket.emit('error', { message: 'Failed to join conversation' });
        }
      });

      // Leave conversation room
      socket.on('leave_conversation', (conversationId: string) => {
        socket.leave(`conversation_${conversationId}`);
        socket.emit('left_conversation', { conversationId });
      });

      // Handle new messages
      socket.on('send_message', async (data: {
        conversationId: string;
        content: string;
        messageType?: string;
        attachedData?: any;
      }) => {
        try {
          const { conversationId, content, messageType = 'TEXT', attachedData } = data;

          // Verify conversation access
          const conversation = await db.select().from(conversations).where(and(
            eq(conversations.id, conversationId),
            or(
              eq(conversations.customerId, socket.userId!),
              eq(conversations.vendorId, socket.userId!)
            )
          ));

          if (conversation.length === 0) {
            socket.emit('error', { message: 'Conversation not found or access denied' });
            return;
          }

          if (conversation[0].status === 'CLOSED') {
            socket.emit('error', { message: 'Cannot send message to closed conversation' });
            return;
          }

          // Save message to database
          const newMessage = await db.insert(chatMessages).values({
            conversationId,
            senderId: socket.userId!,
            content,
            messageType: messageType as any,
            attachedData,
          }).returning();

          // Update conversation
          await db.update(conversations)
            .set({
              lastMessage: content,
              lastMessageAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(conversations.id, conversationId));

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
            .where(eq(chatMessages.id, newMessage[0].id));

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

        } catch (error) {
          console.error('Send message error:', error);
          socket.emit('error', { message: 'Failed to send message' });
        }
      });

      // Handle typing indicators
      socket.on('typing_start', (conversationId: string) => {
        socket.to(`conversation_${conversationId}`).emit('user_typing', {
          conversationId,
          userId: socket.userId,
        });
      });

      socket.on('typing_stop', (conversationId: string) => {
        socket.to(`conversation_${conversationId}`).emit('user_stopped_typing', {
          conversationId,
          userId: socket.userId,
        });
      });

      // Handle message read status
      socket.on('mark_messages_read', async (conversationId: string) => {
        try {
          await db.update(chatMessages)
            .set({ isRead: true })
            .where(and(
              eq(chatMessages.conversationId, conversationId),
              eq(chatMessages.isRead, false)
            ));

          socket.to(`conversation_${conversationId}`).emit('messages_read', {
            conversationId,
            userId: socket.userId,
          });
        } catch (error) {
          console.error('Mark messages read error:', error);
        }
      });

      // Handle user status updates
      socket.on('update_user_status', (status: 'online' | 'away' | 'busy') => {
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
  public sendNotificationToUser(userId: number, notification: any) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit('notification', notification);
    }
  }

  // Method to broadcast to conversation
  public broadcastToConversation(conversationId: string, event: string, data: any) {
    this.io.to(`conversation_${conversationId}`).emit(event, data);
  }

  // Get online users
  public getOnlineUsers(): number[] {
    return Array.from(this.connectedUsers.keys());
  }

  // Check if user is online
  public isUserOnline(userId: number): boolean {
    return this.connectedUsers.has(userId);
  }
}

export let websocketService: WebSocketService;

export const initializeWebSocket = (server: Server) => {
  websocketService = new WebSocketService(server);
  return websocketService;
};
