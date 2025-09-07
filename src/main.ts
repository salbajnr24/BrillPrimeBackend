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

const app = express();
const PORT = process.env.PORT || 5000;

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