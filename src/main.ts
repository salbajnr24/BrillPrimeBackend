import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import passport from 'passport';
import { createServer } from 'http';
import { PORT } from './config/environment';
import { testDatabaseConnection } from './utils/db-test';
import { initializeWebSocket } from './utils/websocket';
import { realtimeHeaders, performanceTracker } from './utils/realtime-middleware';
import morgan from 'morgan';
import { SecurityMiddleware } from './middleware/security';
import { cacheMiddleware } from './middleware/cacheMiddleware';
import { rateLimiter } from './middleware/rateLimiter';
import { ValidationMiddleware } from './middleware/validation';
import { realtimeAnalyticsService } from './services/realtimeAnalytics';
import { messageQueue } from './services/messageQueue';

// Route imports
import authRoutes from './routes/auth';
import adminAuthRoutes from './routes/admin-auth';
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
import searchRoutes from './routes/search';
import socialAuthRoutes from './routes/social-auth';
import reportsRoutes from './routes/reports';
import fuelRoutes from './routes/fuel';
import tollRoutes from './routes/toll';
import testEmailRoutes from './routes/test-email';
import testValidationRoutes from './routes/test-validation';
import realtimeApiRoutes from './routes/realtime-api';
import fraudDetectionRoutes from './routes/fraud-detection';
import contentModerationRoutes from './routes/content-moderation';
import systemMonitoringRoutes from './routes/system-monitoring';
import qrPaymentsRoutes from './routes/qr-payments';
import liveChatRoutes from './routes/live-chat';
import walletRoutes from './routes/wallet';
import securityRoutes from './routes/security';
import businessCategoriesRoutes from './routes/business-categories';
import openingHoursRoutes from './routes/opening-hours';
import reviewsRoutes from './routes/reviews';
import geoRoutes from './routes/geo';
import driverManagementRoutes from './routes/driver-management';
import autoAssignmentRoutes from './routes/auto-assignment';

const app = express();
const server = createServer(app);
const serverPort = PORT || 3000;

// Security middleware
const securityMiddlewares = SecurityMiddleware.create({
  enableHelmet: true,
  enableRateLimit: true
});
securityMiddlewares.forEach(middleware => app.use(middleware));

// Rate limiting
app.use('/api/', rateLimiter.middleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
  message: 'Too many requests from this IP'
}));

// Stricter rate limiting for auth endpoints
app.use('/api/auth/', rateLimiter.middleware({
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
  message: 'Too many authentication attempts'
}));

// Basic middleware
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(ValidationMiddleware.sanitizeHtml);

// Passport middleware
app.use(passport.initialize());

// Real-time API middleware
app.use('/api', realtimeHeaders);
app.use('/api', performanceTracker);

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
app.use('/admin/auth', adminAuthRoutes);
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
app.use('/api/search', searchRoutes);
app.use('/api/social-auth', socialAuthRoutes);
app.use('/api/report', reportsRoutes);
app.use('/api/fuel', fuelRoutes);
app.use('/api/toll', tollRoutes);
app.use('/api/test-email', testEmailRoutes);
app.use('/api/test-validation', testValidationRoutes);
app.use('/api/realtime', realtimeApiRoutes);
app.use('/api/fraud', fraudDetectionRoutes);
app.use('/api/moderation', contentModerationRoutes);
app.use('/api/system', systemMonitoringRoutes);
app.use('/api/qr', qrPaymentsRoutes);
app.use('/api/chat', liveChatRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/business-categories', businessCategoriesRoutes);
app.use('/api/opening-hours', openingHoursRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/geo', geoRoutes);
app.use('/api/drivers', driverManagementRoutes);
app.use('/api/auto-assignment', autoAssignmentRoutes);

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
      adminAuth: {
        'POST /admin/auth/register': 'Register a new admin user (requires admin key)',
        'POST /admin/auth/login': 'Login admin user',
        'POST /admin/auth/logout': 'Logout admin user',
        'POST /admin/auth/reset-password': 'Reset admin password',
      },
      users: {
        'GET /api/users/profile': 'Get user profile (authenticated)',
        'PUT /api/users/profile': 'Update user profile (authenticated)',
        'GET /api/users/merchants': 'Get all merchants (public)',
        'GET /api/users/merchants/:id': 'Get merchant details (public)',
        'PUT /api/users/merchant-profile': 'Update merchant profile (merchant only)',
        'PUT /api/users/driver-profile': 'Update driver profile (driver only)',
        'POST /api/users/location': 'Update user location (authenticated)',
        'PUT /api/users/role': 'Switch user role between CONSUMER, MERCHANT, DRIVER (authenticated)',
        'GET /api/users/search': 'Search users publicly (query param: q, optional: type, page, limit)',
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
        'PUT /api/orders/:id/cancel': 'Cancel order (consumer only)',
        'POST /api/orders/:id/refund': 'Process refund (merchant/admin only)',
        'POST /api/orders/:id/review': 'Add order review (authenticated)',
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
        'GET /api/delivery/earnings': 'Get driver earnings (driver only)',
        'POST /api/delivery/request-payout': 'Request payout (driver only)',
        'GET /api/delivery/:id/route': 'Get delivery route (driver only)',
        'POST /api/delivery/:id/review': 'Add delivery review (authenticated)',
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
        'POST /api/payment/refund/:id': 'Process payment refund (merchant/admin)',
        'POST /api/payment/dispute/:id': 'Create payment dispute (authenticated)',
        'POST /api/payment/payout': 'Request payout (merchant/driver)',
        'GET /api/payment/payout/history': 'Get payout history (merchant/driver)',
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
      socialAuth: {
        'POST /api/social-auth/google': 'Google OAuth authentication',
        'POST /api/social-auth/facebook': 'Facebook OAuth authentication',
        'POST /api/social-auth/apple': 'Apple OAuth authentication',
      },
      search: {
        'GET /api/search/products': 'Advanced product search with geo-location support',
        'GET /api/search/merchants': 'Search merchants with location filtering',
      },
      fuel: {
        'POST /api/fuel/order': 'Place fuel order (bulk or small scale)',
        'GET /api/fuel/orders': 'View user fuel orders',
        'GET /api/fuel/orders/:id': 'Get fuel order details',
        'PUT /api/fuel/orders/:id/cancel': 'Cancel fuel order',
        'GET /api/fuel/merchant/orders': 'View incoming fuel orders (merchant)',
        'PUT /api/fuel/orders/:id/status': 'Update order status (merchant)',
        'GET /api/fuel/inventory': 'Manage fuel inventory (merchant)',
        'PUT /api/fuel/inventory': 'Update fuel inventory (merchant)',
        'GET /api/fuel/deliveries': 'Assigned fuel deliveries (driver)',
        'PUT /api/fuel/deliveries/:id/status': 'Update delivery status (driver)',
      },
      toll: {
        'POST /api/toll/pay': 'Make toll gate payment (consumers/drivers)',
        'GET /api/toll/history': 'View toll payment history (consumers/drivers)',
        'GET /api/toll/:id/receipt': 'Get toll payment receipt with QR code',
        'GET /api/toll/transactions': 'View all toll payments (admin only)',
        'GET /api/toll/stats': 'Get toll usage analytics (admin only)',
        'POST /api/toll/locations': 'Add new toll location (admin only)',
        'PUT /api/toll/locations/:id': 'Update toll pricing/location info (admin only)',
        'GET /api/toll/locations': 'Get all toll locations (public)',
      },
      testEmail: {
        'POST /api/test-email': 'Send a test email using Gmail SMTP',
      },
      realtimeApi: {
        'GET /api/realtime/health': 'Real-time database health check',
        'GET /api/realtime/dashboard/stats': 'Get real-time dashboard statistics',
        'GET /api/realtime/users/:id': 'Get user by ID with real-time data',
        'GET /api/realtime/users/role/:role': 'Get users by role in real-time',
        'GET /api/realtime/products/active': 'Get active products in real-time',
        'GET /api/realtime/products/seller/:sellerId': 'Get seller products in real-time',
        'GET /api/realtime/orders/user/:userId': 'Get user orders in real-time',
        'GET /api/realtime/orders/status/:status': 'Get orders by status in real-time',
        'GET /api/realtime/activity/user/:userId': 'Get user recent activity in real-time',
        'GET /api/realtime/security/fraud-alerts': 'Get active fraud alerts in real-time',
      },
      fraudDetection: {
        'GET /api/fraud/alerts': 'Get fraud alerts with filtering (admin only)',
        'GET /api/fraud/stats': 'Get fraud detection statistics (admin only)',
        'GET /api/fraud/activities': 'Get suspicious activities (admin only)',
        'POST /api/fraud/alerts/:alertId/investigate': 'Mark alert as investigating (admin only)',
        'POST /api/fraud/alerts/:alertId/resolve': 'Resolve fraud alert (admin only)',
        'POST /api/fraud/users/:userId/flag': 'Flag user account for fraud (admin only)',
        'POST /api/fraud/alerts/bulk-action': 'Bulk action on fraud alerts (admin only)',
      },
      contentModeration: {
        'GET /api/moderation/reports': 'Get content moderation reports (admin only)',
        'POST /api/moderation/reports/:id/action': 'Take action on content report (admin only)',
        'POST /api/moderation/reports/bulk-action': 'Bulk action on reports (admin only)',
        'GET /api/moderation/stats': 'Get moderation statistics (admin only)',
      },
      systemMonitoring: {
        'GET /api/system/health': 'Get system health status (admin only)',
        'GET /api/system/metrics/realtime': 'Get real-time system metrics (admin only)',
        'GET /api/system/performance': 'Get performance metrics (admin only)',
        'GET /api/system/errors': 'Get system error logs (admin only)',
        'POST /api/system/maintenance/backup': 'Initiate database backup (admin only)',
      },
      qrPayments: {
        'POST /api/qr/generate': 'Generate QR code for payment (authenticated)',
        'POST /api/qr/pay/:qrId': 'Process QR code payment (authenticated)',
        'GET /api/qr/:qrId': 'Get QR code details (public)',
        'GET /api/qr/user/codes': 'Get user\'s QR codes (authenticated)',
        'DELETE /api/qr/:qrId': 'Cancel QR code (authenticated)',
      },
      liveChat: {
        'POST /api/chat/conversations': 'Start new conversation (authenticated)',
        'GET /api/chat/conversations': 'Get user conversations (authenticated)',
        'GET /api/chat/conversations/:id/messages': 'Get conversation messages (authenticated)',
        'POST /api/chat/conversations/:id/messages': 'Send message (authenticated)',
        'GET /api/chat/admin/conversations': 'Get all conversations (admin only)',
        'POST /api/chat/admin/conversations/:id/assign': 'Assign conversation to agent (admin only)',
        'POST /api/chat/admin/conversations/:id/close': 'Close conversation (admin only)',
        'GET /api/chat/admin/stats': 'Get chat statistics (admin only)',
      },
      wallet: {
        'POST /api/wallet/create': 'Create a new wallet for the user',
        'GET /api/wallet/balance': 'Get user wallet balance',
        'POST /api/wallet/deposit': 'Deposit funds into the wallet',
        'POST /api/wallet/withdraw': 'Withdraw funds from the wallet',
        'GET /api/wallet/history': 'Get transaction history for the wallet',
      },
      security: {
        'POST /api/security/enable-2fa': 'Enable two-factor authentication',
        'POST /api/security/disable-2fa': 'Disable two-factor authentication',
        'POST /api/security/change-password': 'Change user password',
        'POST /api/security/login-history': 'View user login history',
        'GET /api/security/logs': 'Get security logs (admin only)',
      },
      businessCategories: {
        'GET /api/business-categories': 'Get all business categories (public)',
        'POST /api/business-categories': 'Create business category (admin only)',
        'GET /api/business-categories/:id': 'Get specific business category (public)',
        'PUT /api/business-categories/:id': 'Update business category (admin only)',
        'DELETE /api/business-categories/:id': 'Delete business category (admin only)',
        'POST /api/business-categories/:id/subcategories': 'Add subcategory to business category (admin only)',
        'GET /api/business-categories/:id/subcategories': 'Get subcategories of a business category (public)',
      },
      openingHours: {
        'GET /api/opening-hours': 'Get opening hours for all vendors (public)',
        'POST /api/opening-hours': 'Create opening hours for a vendor (merchant/admin)',
        'GET /api/opening-hours/:vendorId': 'Get opening hours for a specific vendor (public)',
        'PUT /api/opening-hours/:id': 'Update opening hours for a vendor (merchant/admin)',
        'DELETE /api/opening-hours/:id': 'Delete opening hours for a vendor (merchant/admin)',
      },
      trustSafety: {
        'POST /api/report/user/:id': 'Report a user for abuse, scam, etc.',
        'POST /api/report/product/:id': 'Report a product for fake listing, scam, etc.',
        'GET /api/report/my-reports': 'View your submitted reports',
        'GET /api/report/admin/all': 'Admin: View all reports',
        'GET /api/report/admin/fraud-alerts': 'Admin: View fraud detection alerts',
        'POST /api/report/admin/blacklist': 'Admin: Add entity to blacklist',
        'DELETE /api/report/admin/blacklist/:id': 'Admin: Remove from blacklist',
      },
      driverManagement: {
        'GET /api/drivers': 'Get list of all drivers (admin only)',
        'GET /api/drivers/:id': 'Get specific driver details (admin/driver only)',
        'PUT /api/drivers/:id': 'Update driver profile (admin/driver only)',
        'POST /api/drivers': 'Create a new driver (admin only)',
        'DELETE /api/drivers/:id': 'Delete a driver (admin only)',
        'GET /api/drivers/pending-verification': 'Get drivers pending verification (admin only)',
        'PUT /api/drivers/:id/verify': 'Verify a driver (admin only)',
        'PUT /api/drivers/:id/suspend': 'Suspend a driver (admin only)',
        'PUT /api/drivers/:id/activate': 'Activate a driver (admin only)',
      },
      autoAssignment: {
        'POST /api/auto-assignment/settings': 'Configure auto-assignment settings (admin only)',
        'GET /api/auto-assignment/settings': 'Get auto-assignment settings (admin only)',
        'GET /api/auto-assignment/drivers': 'Get available drivers for assignment',
        'POST /api/auto-assignment/assign/:deliveryId': 'Manually assign a delivery to a driver',
        'GET /api/auto-assignment/assignments/driver/:driverId': 'Get deliveries assigned to a driver',
        'GET /api/auto-assignment/assignments/delivery/:deliveryId': 'Get driver assigned to a delivery',
      }
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

// Initialize WebSocket and start server
initializeWebSocket(server);

server.listen(parseInt(serverPort as string), '0.0.0.0', () => {
  console.log(`🚀 BrillPrime Backend server is running on port ${serverPort}`);
  console.log(`📖 API Documentation: http://localhost:${serverPort}/api`);
  console.log(`🏥 Health Check: http://localhost:${serverPort}/health`);
  console.log(`💬 WebSocket server initialized for real-time chat`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

  // Test database connection
  testDatabaseConnection().then(success => {
    if (success) {
      console.log('✅ Database connection successful');
    } else {
      console.log('❌ Database connection failed');
    }
  });
});

export default app;