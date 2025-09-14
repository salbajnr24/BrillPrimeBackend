"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const passport_1 = __importDefault(require("passport"));
const http_1 = require("http");
const environment_1 = require("./config/environment");
const db_test_1 = require("./utils/db-test");
const websocket_1 = require("./utils/websocket");
// Route imports
const auth_1 = __importDefault(require("./routes/auth"));
const admin_auth_1 = __importDefault(require("./routes/admin-auth"));
const users_1 = __importDefault(require("./routes/users"));
const products_1 = __importDefault(require("./routes/products"));
const cart_1 = __importDefault(require("./routes/cart"));
const orders_1 = __importDefault(require("./routes/orders"));
const delivery_1 = __importDefault(require("./routes/delivery"));
const social_1 = __importDefault(require("./routes/social"));
const chat_1 = __importDefault(require("./routes/chat"));
const analytics_1 = __importDefault(require("./routes/analytics"));
const payment_1 = __importDefault(require("./routes/payment"));
const commodities_1 = __importDefault(require("./routes/commodities"));
const notifications_1 = __importDefault(require("./routes/notifications"));
const support_1 = __importDefault(require("./routes/support"));
const verification_1 = __importDefault(require("./routes/verification"));
const upload_1 = __importDefault(require("./routes/upload"));
const admin_1 = __importDefault(require("./routes/admin"));
const receipts_1 = __importDefault(require("./routes/receipts"));
const search_1 = __importDefault(require("./routes/search"));
const social_auth_1 = __importDefault(require("./routes/social-auth"));
const reports_1 = __importDefault(require("./routes/reports"));
const fuel_1 = __importDefault(require("./routes/fuel")); // Import fuel routes
const toll_1 = __importDefault(require("./routes/toll")); // Import toll routes
const test_email_1 = __importDefault(require("./routes/test-email")); // Import test email routes
const test_validation_1 = __importDefault(require("./routes/test-validation")); // Import test validation routes
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const serverPort = environment_1.PORT || 3000;
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Passport middleware
app.use(passport_1.default.initialize());
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
app.use('/api/auth', auth_1.default);
app.use('/admin/auth', admin_auth_1.default);
app.use('/api/users', users_1.default);
app.use('/api/products', products_1.default);
app.use('/api/cart', cart_1.default);
app.use('/api/orders', orders_1.default);
app.use('/api/delivery', delivery_1.default);
app.use('/api/social', social_1.default);
app.use('/api/chat', chat_1.default);
app.use('/api/analytics', analytics_1.default);
app.use('/api/payment', payment_1.default);
app.use('/api/commodities', commodities_1.default);
app.use('/api/notifications', notifications_1.default);
app.use('/api/support', support_1.default);
app.use('/api/verification', verification_1.default);
app.use('/api/upload', upload_1.default);
app.use('/api/admin', admin_1.default);
app.use('/api/receipts', receipts_1.default);
app.use('/api/search', search_1.default);
app.use('/api/social-auth', social_auth_1.default);
app.use('/api/report', reports_1.default);
app.use('/api/fuel', fuel_1.default); // Register fuel routes
app.use('/api/toll', toll_1.default); // Register toll routes
app.use('/api/test-email', test_email_1.default); // Register test email routes
app.use('/api/test-validation', test_validation_1.default); // Register validation test routes
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
            trustSafety: {
                'POST /api/report/user/:id': 'Report a user for abuse, scam, etc.',
                'POST /api/report/product/:id': 'Report a product for fake listing, scam, etc.',
                'GET /api/report/my-reports': 'View your submitted reports',
                'GET /api/report/admin/all': 'Admin: View all reports',
                'GET /api/report/admin/fraud-alerts': 'Admin: View fraud detection alerts',
                'POST /api/report/admin/blacklist': 'Admin: Add entity to blacklist',
                'DELETE /api/report/admin/blacklist/:id': 'Admin: Remove from blacklist',
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
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
});
// Initialize WebSocket and start server
(0, websocket_1.initializeWebSocket)(server);
server.listen(parseInt(serverPort), '0.0.0.0', () => {
    console.log(`🚀 BrillPrime Backend server is running on port ${serverPort}`);
    console.log(`📖 API Documentation: http://localhost:${serverPort}/api`);
    console.log(`🏥 Health Check: http://localhost:${serverPort}/health`);
    console.log(`💬 WebSocket server initialized for real-time chat`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    // Test database connection
    (0, db_test_1.testDatabaseConnection)().then(success => {
        if (success) {
            console.log('✅ Database connection successful');
        }
        else {
            console.log('❌ Database connection failed');
        }
    });
});
exports.default = app;
