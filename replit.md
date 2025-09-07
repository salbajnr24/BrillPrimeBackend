# BrillPrime Backend

## Overview

BrillPrime is a comprehensive e-commerce and delivery platform backend that connects consumers, merchants, and drivers in a multi-sided marketplace. The platform facilitates product listings, order management, real-time chat, delivery services, and social features for vendors. Built with Express.js and TypeScript, it provides a robust API for mobile and web applications.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Backend Framework
- **Express.js with TypeScript**: Chosen for its simplicity, extensive ecosystem, and strong typing support
- **Modular route structure**: Organized by feature domains (auth, products, orders, delivery, etc.)
- **Middleware stack**: Helmet for security, CORS for cross-origin requests, express.json for body parsing

### Database Layer
- **PostgreSQL with Drizzle ORM**: Type-safe database queries with excellent TypeScript integration
- **Schema-first approach**: Database schema defined in TypeScript with automatic type generation
- **Migration management**: Uses Drizzle Kit for database migrations and schema management

### Authentication & Authorization
- **JWT-based authentication**: Stateless token-based auth with configurable expiration
- **Role-based access control**: Three user roles (CONSUMER, MERCHANT, DRIVER) with different permissions
- **Password security**: bcryptjs for password hashing with salt rounds
- **OTP verification**: Email-based verification for account security

### Data Models
- **Users**: Multi-role user system with profile management and location tracking
- **Products & Categories**: Hierarchical product catalog with merchant ownership
- **Orders & Cart**: Shopping cart functionality with order lifecycle management
- **Delivery System**: Comprehensive delivery request and tracking system
- **Social Features**: Vendor posts, likes, comments for merchant engagement
- **Chat System**: Real-time messaging between users with conversation management

### Communication Layer
- **Email Service**: Nodemailer integration for OTP delivery and notifications
- **RESTful API**: Standard HTTP methods with JSON responses
- **Error handling**: Centralized error responses with appropriate HTTP status codes

### Security Features
- **Helmet.js**: Security headers and protection against common vulnerabilities
- **Input validation**: Request validation and sanitization
- **CORS configuration**: Cross-origin resource sharing with credential support
- **Environment configuration**: Secure configuration management with dotenv

### File Structure
- `/src/routes/`: Feature-based route handlers
- `/src/schema/`: Database schema definitions with Drizzle ORM
- `/src/utils/`: Shared utilities for auth, email, and common functions
- `/src/config/`: Database configuration and connection management

## External Dependencies

### Database
- **PostgreSQL**: Primary relational database for data persistence
- **Drizzle ORM**: Type-safe database toolkit for PostgreSQL integration

### Authentication & Security
- **bcryptjs**: Password hashing and comparison
- **jsonwebtoken**: JWT token generation and verification
- **helmet**: Security middleware for Express.js

### Communication
- **nodemailer**: Email service for OTP and notification delivery
- **Redis**: Session storage and caching (configured but implementation may be pending)

### Development Tools
- **TypeScript**: Static typing and enhanced developer experience
- **ts-node-dev**: Development server with hot reloading
- **Drizzle Kit**: Database migration and introspection tools

### Utilities
- **uuid**: Unique identifier generation
- **axios**: HTTP client for external API calls
- **multer**: File upload handling middleware
- **class-validator & class-transformer**: Data validation and transformation

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT token signing
- `EMAIL_USER` & `EMAIL_PASS`: Email service credentials
- `PORT`: Server port configuration