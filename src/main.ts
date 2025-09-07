import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import 'dotenv/config';

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import productRoutes from './routes/products';
import cartRoutes from './routes/cart';
import orderRoutes from './routes/orders';
import deliveryRoutes from './routes/delivery';
import socialRoutes from './routes/social';
import chatRoutes from './routes/chat';
import analyticsRoutes from './routes/analytics';
import paymentRoutes from './routes/payment';
import commoditiesRoutes from './routes/commodities';
import notificationsRoutes from './routes/notifications';
import supportRoutes from './routes/support';
import verificationRoutes from './routes/verification';
import uploadRoutes from './routes/upload';
import adminRoutes from './routes/admin';
import receiptsRoutes from './routes/receipts';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'BrillPrime Backend API is running!',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/commodities', commoditiesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/receipts', receiptsRoutes);

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'BrillPrime API v1.0.0',
    documentation: {
      auth: {
        'POST /api/auth/register': 'Register a new user',
        'POST /api/auth/login': 'Login user',
        'POST /api/auth/verify-otp': 'Verify email with OTP',
        'POST /api/auth/resend-otp': 'Resend OTP code',
      },
      users: {
        'GET /api/users/profile': 'Get user profile (authenticated)',
        'PUT /api/users/profile': 'Update user profile (authenticated)',
        'GET /api/users/merchants': 'Get all merchants (public)',
        'GET /api/users/merchants/:id': 'Get merchant details (public)',
        'PUT /api/users/merchant-profile': 'Update merchant profile (merchant only)',
        'PUT /api/users/driver-profile': 'Update driver profile (driver only)',
        'POST /api/users/location': 'Update user location (authenticated)',
      },
      products: {
        'GET /api/products': 'Get all products with filters (public)',
        'GET /api/products/:id': 'Get single product (public)',
        'POST /api/products': 'Create product (merchant only)',
        'PUT /api/products/:id': 'Update product (product owner only)',
        'DELETE /api/products/:id': 'Delete product (product owner only)',
        'GET /api/products/categories': 'Get all categories (public)',
        'POST /api/products/categories': 'Create category (merchant only)',
        'GET /api/products/seller/:sellerId': 'Get products by seller (public)',
      },
      cart: {
        'GET /api/cart': 'Get user cart (authenticated)',
        'POST /api/cart/add': 'Add item to cart (authenticated)',
        'PUT /api/cart/:id': 'Update cart item quantity (authenticated)',
        'DELETE /api/cart/:id': 'Remove item from cart (authenticated)',
        'DELETE /api/cart': 'Clear cart (authenticated)',
      },
      orders: {
        'POST /api/orders/checkout': 'Create order from cart (authenticated)',
        'GET /api/orders/my-orders': 'Get user orders (authenticated)',
        'GET /api/orders/merchant-orders': 'Get merchant orders (merchant only)',
        'PUT /api/orders/:id/status': 'Update order status (merchant only)',
        'GET /api/orders/:id': 'Get order details (authenticated)',
      },
      delivery: {
        'POST /api/delivery/request': 'Create delivery request (authenticated)',
        'GET /api/delivery/available': 'Get available deliveries (driver only)',
        'POST /api/delivery/:id/accept': 'Accept delivery request (driver only)',
        'PUT /api/delivery/:id/status': 'Update delivery status (driver only)',
        'GET /api/delivery/my-deliveries': 'Get driver deliveries (driver only)',
        'GET /api/delivery/track/:trackingNumber': 'Track delivery (public)',
        'GET /api/delivery/stats': 'Get delivery statistics (driver only)',
      },
      social: {
        'POST /api/social/posts': 'Create vendor post (merchant only)',
        'GET /api/social/posts': 'Get vendor posts feed (public)',
        'GET /api/social/posts/:id': 'Get single post (public)',
        'POST /api/social/posts/:id/like': 'Like/unlike post (authenticated)',
        'POST /api/social/posts/:id/comments': 'Add comment to post (authenticated)',
        'GET /api/social/posts/:id/comments': 'Get post comments (public)',
        'PUT /api/social/posts/:id': 'Update post (post owner only)',
        'DELETE /api/social/posts/:id': 'Delete post (post owner only)',
      },
      chat: {
        'POST /api/chat/conversations': 'Start conversation (authenticated)',
        'GET /api/chat/conversations': 'Get user conversations (authenticated)',
        'POST /api/chat/conversations/:id/messages': 'Send message (authenticated)',
        'GET /api/chat/conversations/:id/messages': 'Get conversation messages (authenticated)',
        'GET /api/chat/conversations/:id': 'Get conversation details (authenticated)',
        'PUT /api/chat/conversations/:id/close': 'Close conversation (authenticated)',
      },
      analytics: {
        'GET /api/analytics/dashboard': 'Get merchant dashboard analytics (merchant only)',
        'GET /api/analytics/sales': 'Get sales analytics (merchant only)',
        'POST /api/analytics/record-daily': 'Record daily analytics (merchant only)',
        'GET /api/analytics/profile': 'Get merchant profile analytics (merchant only)',
      },
      payment: {
        'POST /api/payment/initialize': 'Initialize payment transaction (authenticated)',
        'POST /api/payment/verify': 'Verify payment transaction (authenticated)',
        'GET /api/payment/history': 'Get payment history (authenticated)',
      },
      commodities: {
        'GET /api/commodities': 'Get all commodities with filters (public)',
        'GET /api/commodities/:id': 'Get single commodity (public)',
        'POST /api/commodities': 'Create commodity (admin only)',
        'PUT /api/commodities/:id': 'Update commodity (admin only)',
        'DELETE /api/commodities/:id': 'Delete commodity (admin only)',
      },
      notifications: {
        'GET /api/notifications': 'Get merchant notifications (merchant only)',
        'PUT /api/notifications/:id/read': 'Mark notification as read (merchant only)',
        'PUT /api/notifications/mark-all-read': 'Mark all notifications as read (merchant only)',
        'GET /api/notifications/unread-count': 'Get unread notifications count (merchant only)',
        'POST /api/notifications': 'Create notification (internal/system use)',
        'DELETE /api/notifications/:id': 'Delete notification (merchant only)',
      },
      support: {
        'POST /api/support/tickets': 'Create support ticket (public/authenticated)',
        'GET /api/support/tickets': 'Get user support tickets (authenticated)',
        'GET /api/support/tickets/:id': 'Get specific ticket details (authenticated/public with email)',
        'PUT /api/support/tickets/:id': 'Update ticket (admin only)',
        'GET /api/support/admin/tickets': 'Get all tickets (admin only)',
        'GET /api/support/admin/stats': 'Get support statistics (admin only)',
      },
      verification: {
        'POST /api/verification/identity': 'Submit identity verification (authenticated)',
        'POST /api/verification/driver': 'Submit driver verification (driver only)',
        'POST /api/verification/phone': 'Submit phone verification (authenticated)',
        'POST /api/verification/phone/verify': 'Verify phone OTP (authenticated)',
        'GET /api/verification/status': 'Get verification status (authenticated)',
        'PUT /api/verification/admin/identity/:id/approve': 'Approve identity verification (admin only)',
        'PUT /api/verification/admin/identity/:id/reject': 'Reject identity verification (admin only)',
        'PUT /api/verification/admin/driver/:id/approve': 'Approve driver verification (admin only)',
        'PUT /api/verification/admin/driver/:id/reject': 'Reject driver verification (admin only)',
        'GET /api/verification/admin/pending': 'Get pending verifications (admin only)',
      },
      upload: {
        'POST /api/upload/image': 'Upload single image (authenticated)',
        'POST /api/upload/images': 'Upload multiple images (authenticated)',
        'POST /api/upload/document': 'Upload document (authenticated)',
        'DELETE /api/upload/:type/:filename': 'Delete uploaded file (authenticated)',
        'GET /api/upload/info/:type/:filename': 'Get file info (public)',
        'GET /api/upload/:type/:filename': 'Serve uploaded files (public)',
      },
      admin: {
        'GET /api/admin/users': 'Get all users with filters (admin only)',
        'PUT /api/admin/users/:id/verify': 'Verify user identity (admin only)',
        'GET /api/admin/analytics/platform': 'Get platform-wide analytics (admin only)',
        'GET /api/admin/drivers/verification-requests': 'Get pending driver verifications (admin only)',
        'PUT /api/admin/users/:id/status': 'Suspend or activate user account (admin only)',
        'GET /api/admin/system/health': 'Get system health metrics (admin only)',
      },
      receipts: {
        'POST /api/receipts/generate': 'Generate receipt and QR code for completed order (authenticated)',
        'GET /api/receipts/:receiptNumber': 'Get receipt details by receipt number (public)',
        'GET /api/receipts/user/all': 'Get user\'s receipts (authenticated)',
        'POST /api/receipts/scan': 'Scan QR code for verification (authenticated)',
      },
    },
    authentication: {
      type: 'Bearer Token',
      header: 'Authorization: Bearer <token>',
      note: 'Include JWT token in Authorization header for authenticated endpoints',
    },
    roles: {
      CONSUMER: 'Regular users who can browse and purchase products',
      MERCHANT: 'Business users who can create and manage products',
      DRIVER: 'Delivery personnel who handle deliveries',
      ADMIN: 'Super administrator with full control over the system',
    },
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The endpoint ${req.method} ${req.originalUrl} does not exist`,
    availableEndpoints: '/api for API documentation',
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global error handler:', err);

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Start server
app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 BrillPrime Backend server is running on port ${PORT}`);
  console.log(`📖 API Documentation: http://localhost:${PORT}/api`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;