# BrillPrime E-commerce Backend API

## Overview
BrillPrime is a comprehensive e-commerce backend API built with Node.js, TypeScript, Express, and PostgreSQL using Drizzle ORM. It provides a complete solution for multi-role marketplace operations including consumers, merchants, and drivers.

## Current State
- ✅ Server running on port 3000 
- ✅ Database connected (PostgreSQL)
- ✅ All major routes configured
- ✅ WebSocket support for real-time features
- ✅ Authentication and authorization system
- ✅ Role-based access control (CONSUMER, MERCHANT, DRIVER, ADMIN)

## Recent Changes (September 18, 2025)
- Fixed duplicate router declarations in geo.ts
- Resolved missing imports for authentication middleware 
- Configured database connection for Replit environment
- Set up proper port configuration (backend on 3000)
- Fixed foreign key type mismatches in schema
- Configured deployment settings for autoscale production

## Project Architecture

### Core Technologies
- **Runtime**: Node.js 18
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT with role-based access control
- **Real-time**: WebSocket integration

### Key Features
- Multi-role user system (Consumer, Merchant, Driver, Admin)
- Product catalog management
- Order processing and tracking
- Real-time chat system
- Geo-location services
- Payment integration (Paystack)
- QR code generation for receipts
- Fuel ordering system
- Toll payment system
- Admin dashboard and analytics
- Content moderation
- Fraud detection
- Support ticket system

### Database Schema
The database includes 40+ tables supporting:
- User management and profiles
- Product catalog and inventory
- Order processing and fulfillment
- Real-time messaging
- Payment and transaction handling
- Location-based services
- Analytics and reporting
- Security and fraud detection

### API Endpoints
The API provides comprehensive endpoints for all major e-commerce operations:
- Authentication and user management
- Product catalog operations
- Shopping cart functionality
- Order processing
- Payment integration
- Real-time communication
- Location services
- Admin operations

### Environment Configuration
- Development mode configured for Replit
- Database automatically connected via DATABASE_URL
- JWT secrets configured with fallbacks
- Port 3000 configured for backend services

## Development Workflow
- `npm run start:dev`: Start development server with auto-reload
- `npm run build`: Build TypeScript to JavaScript
- `npm start`: Run production build
- `npm run db:push`: Push schema changes to database

## Deployment
Configured for Replit autoscale deployment:
- Build command: `npm run build`
- Run command: `npm start`
- Deployment target: autoscale (suitable for stateless API)

The backend is ready for production deployment and can handle multiple concurrent users with automatic scaling based on demand.