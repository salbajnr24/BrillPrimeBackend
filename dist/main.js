"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
require("dotenv/config");
// Import routes
const auth_1 = __importDefault(require("./routes/auth"));
const users_1 = __importDefault(require("./routes/users"));
const products_1 = __importDefault(require("./routes/products"));
const cart_1 = __importDefault(require("./routes/cart"));
const orders_1 = __importDefault(require("./routes/orders"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
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
app.use('/api/users', users_1.default);
app.use('/api/products', products_1.default);
app.use('/api/cart', cart_1.default);
app.use('/api/orders', orders_1.default);
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
// Start server
app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 BrillPrime Backend server is running on port ${PORT}`);
    console.log(`📖 API Documentation: http://localhost:${PORT}/api`);
    console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});
exports.default = app;
//# sourceMappingURL=main.js.map