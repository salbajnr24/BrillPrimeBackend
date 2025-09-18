
# BrillPrime Backend API Documentation

Complete API documentation for all implemented endpoints.

## Authentication Endpoints

### Register User
- **POST** `/api/auth/register`
- **Body**: `{ fullName, email, phone, password, role }`
- **Response**: User creation confirmation + OTP sent

### Login User  
- **POST** `/api/auth/login`
- **Body**: `{ email, password }`
- **Response**: JWT token + user info + role-based redirect

### Verify OTP
- **POST** `/api/auth/verify-otp`
- **Body**: `{ email, otp }`
- **Response**: JWT token + verified user info

### Resend OTP
- **POST** `/api/auth/resend-otp`
- **Body**: `{ email }`
- **Response**: New OTP sent confirmation

### Forgot Password
- **POST** `/api/auth/forgot-password`
- **Body**: `{ email }`
- **Response**: Reset OTP sent (if email exists)

### Reset Password
- **POST** `/api/auth/reset-password`
- **Body**: `{ email, otp, newPassword }`
- **Response**: Password reset confirmation

### Change Password
- **PUT** `/api/auth/change-password` *(Auth Required)*
- **Body**: `{ currentPassword, newPassword }`
- **Response**: Password change confirmation

---

## Admin Authentication

### Admin Login
- **POST** `/admin/auth/login`
- **Body**: `{ email, password }`
- **Response**: Admin JWT token + redirect to admin dashboard

### Admin Register
- **POST** `/admin/auth/register`
- **Body**: `{ fullName, email, phone, password, adminKey }`
- **Response**: New admin user created

### Admin Logout
- **POST** `/admin/auth/logout`
- **Response**: Logout confirmation

---

## User Management

### Get User Profile
- **GET** `/api/users/profile` *(Auth Required)*
- **Response**: Current user profile data

### Update User Profile
- **PUT** `/api/users/profile` *(Auth Required)*
- **Body**: `{ fullName, phone, address, city, state, country, bio, profilePicture }`
- **Response**: Updated user profile

### Get All Merchants
- **GET** `/api/users/merchants`
- **Query**: `?page=1&limit=10&search=query`
- **Response**: Paginated list of merchant profiles

### Get Merchant Details
- **GET** `/api/users/merchants/:id`
- **Response**: Detailed merchant profile + products

### Update Merchant Profile
- **PUT** `/api/users/merchant-profile` *(Merchant Only)*
- **Body**: Merchant-specific profile fields
- **Response**: Updated merchant profile

### Update Driver Profile
- **PUT** `/api/users/driver-profile` *(Driver Only)*
- **Body**: Driver-specific profile fields
- **Response**: Updated driver profile

### Update User Location
- **POST** `/api/users/location` *(Auth Required)*
- **Body**: `{ latitude, longitude, address }`
- **Response**: Location update confirmation

### Switch User Role
- **PUT** `/api/users/role` *(Auth Required)*
- **Body**: `{ role }` (CONSUMER, MERCHANT, DRIVER)
- **Response**: Role change confirmation

### Search Users
- **GET** `/api/users/search`
- **Query**: `?q=query&type=role&page=1&limit=20`
- **Response**: Filtered user search results

---

## Product Management

### Get All Products
- **GET** `/api/products`
- **Query**: `?page=1&limit=10&search=query&categoryId=1&sellerId=1&minPrice=0&maxPrice=1000&sortBy=price&sortOrder=asc&inStock=true`
- **Response**: Paginated, filtered product list

### Get Single Product
- **GET** `/api/products/:id`
- **Response**: Detailed product information + seller details

### Create Product
- **POST** `/api/products` *(Merchant Only)*
- **Body**: `{ name, description, price, unit, categoryId, image, minimumOrder }`
- **Response**: Created product details

### Update Product
- **PUT** `/api/products/:id` *(Product Owner Only)*
- **Body**: Product update fields
- **Response**: Updated product details

### Delete Product
- **DELETE** `/api/products/:id` *(Product Owner Only)*
- **Response**: Soft deletion confirmation

### Get Products by Seller
- **GET** `/api/products/seller/:sellerId`
- **Response**: All products from specific seller

### Get All Categories
- **GET** `/api/products/categories`
- **Response**: All active product categories

### Create Category
- **POST** `/api/products/categories` *(Merchant Only)*
- **Body**: `{ name, icon, slug, description }`
- **Response**: Created category details

---

## Cart Management

### Get User Cart
- **GET** `/api/cart` *(Auth Required)*
- **Response**: Cart items with product details + total amount

### Add Item to Cart
- **POST** `/api/cart/add` *(Auth Required)*
- **Body**: `{ productId, quantity }`
- **Response**: Added/updated cart item

### Alternative Add to Cart
- **POST** `/api/cart` *(Auth Required)*
- **Body**: `{ productId, quantity }`
- **Response**: Added/updated cart item

### Update Cart Item Quantity
- **PUT** `/api/cart/:id` *(Auth Required)*
- **Body**: `{ quantity }`
- **Response**: Updated cart item

### Remove Cart Item
- **DELETE** `/api/cart/:id` *(Auth Required)*
- **Response**: Item removal confirmation

### Clear Entire Cart
- **DELETE** `/api/cart` *(Auth Required)*
- **Response**: Cart cleared confirmation

---

## Order Management

### Create Order from Cart (Checkout)
- **POST** `/api/orders/checkout` *(Auth Required)*
- **Body**: `{ deliveryAddress }`
- **Response**: Created orders + total price

### Place New Order
- **POST** `/api/orders/place` *(Auth Required)*
- **Body**: `{ deliveryAddress }`
- **Response**: Order creation confirmation

### Get User Orders
- **GET** `/api/orders/my-orders` *(Auth Required)*
- **Query**: `?page=1&limit=10&status=pending`
- **Response**: User's order history

### Get Consumer Orders
- **GET** `/api/orders/consumer-orders` *(Auth Required)*
- **Response**: Consumer-specific order list

### Get Merchant Orders
- **GET** `/api/orders/merchant-orders` *(Merchant Only)*
- **Query**: `?page=1&limit=10&status=pending`
- **Response**: Merchant's received orders

### Get Order Details
- **GET** `/api/orders/:id` *(Auth Required)*
- **Response**: Detailed order information

### Update Order Status
- **PUT** `/api/orders/:id/status` *(Merchant Only)*
- **Body**: `{ status }` (pending, confirmed, preparing, ready, delivered, cancelled)
- **Response**: Updated order status

### Cancel Order
- **PUT** `/api/orders/:id/cancel` *(Consumer Only)*
- **Response**: Order cancellation confirmation

### Process Refund
- **POST** `/api/orders/:id/refund` *(Merchant/Admin Only)*
- **Body**: `{ amount, reason }`
- **Response**: Refund processing confirmation

### Add Order Review
- **POST** `/api/orders/:id/review` *(Auth Required)*
- **Body**: `{ rating, comment }`
- **Response**: Review creation confirmation

---

## Payment System

### Initialize Payment
- **POST** `/api/payment/initialize` *(Auth Required)*
- **Body**: `{ amount, currency, customerEmail }`
- **Response**: Payment link + transaction reference

### Verify Payment
- **POST** `/api/payment/verify` *(Auth Required)*
- **Body**: `{ transactionId, txRef }`
- **Response**: Payment verification status

### Payment Callback
- **GET** `/api/payment/callback`
- **Query**: Auto-handled by payment gateway
- **Response**: Redirect to success/failure page

### Payment Webhook
- **POST** `/api/payment/webhook`
- **Body**: Payment gateway webhook data
- **Response**: Webhook processing confirmation

### Process Payment Refund
- **POST** `/api/payment/refund/:id` *(Merchant/Admin Only)*
- **Body**: `{ amount, reason }`
- **Response**: Refund transaction details

### Create Payment Dispute
- **POST** `/api/payment/dispute/:id` *(Auth Required)*
- **Body**: `{ reason, description, evidence }`
- **Response**: Dispute creation confirmation

### Request Payout
- **POST** `/api/payment/payout` *(Merchant/Driver Only)*
- **Body**: `{ amount, bankAccount }`
- **Response**: Payout request confirmation

### Get Payout History
- **GET** `/api/payment/payout/history` *(Merchant/Driver Only)*
- **Query**: `?page=1&limit=20`
- **Response**: Paginated payout history

### Get Payment History
- **GET** `/api/payment/history` *(Auth Required)*
- **Query**: `?page=1&limit=20&type=PAYMENT`
- **Response**: User's payment transaction history

---

## QR Payment System

### Generate QR Payment Code
- **POST** `/api/qr/generate` *(Auth Required)*
- **Body**: `{ amount, description, expiresIn }`
- **Response**: QR code data + image URL

### Process QR Payment
- **POST** `/api/qr/pay/:qrId` *(Auth Required)*
- **Body**: `{ paymentMethod }`
- **Response**: Payment processing confirmation

### Get QR Code Details
- **GET** `/api/qr/:qrId`
- **Response**: QR code information + merchant details

### Get User's QR Codes
- **GET** `/api/qr/user/codes` *(Auth Required)*
- **Query**: `?status=active&limit=20&page=1`
- **Response**: User's generated QR codes

### Cancel QR Code
- **DELETE** `/api/qr/:qrId` *(Auth Required)*
- **Response**: QR code cancellation confirmation

---

## Wallet System

### Get User Wallet
- **GET** `/api/wallet/:userId`
- **Response**: Wallet balance and details

### Get Wallet Transactions
- **GET** `/api/wallet/:userId/transactions`
- **Query**: `?limit=20&offset=0`
- **Response**: Wallet transaction history

### Fund Wallet
- **POST** `/api/wallet/:userId/fund`
- **Body**: `{ amount, paymentMethod, transactionRef }`
- **Response**: Wallet funding confirmation

### Create Wallet
- **POST** `/api/wallet/create`
- **Body**: `{ userId, currency }`
- **Response**: New wallet creation confirmation

---

## Delivery & Logistics

### Create Delivery Request
- **POST** `/api/delivery/request` *(Auth Required)*
- **Body**: `{ merchantId, orderId, deliveryType, pickupAddress, deliveryAddress, deliveryFee, specialInstructions }`
- **Response**: Delivery request details + tracking number

### Get Available Deliveries
- **GET** `/api/delivery/available` *(Driver Only)*
- **Query**: `?deliveryType=STANDARD&maxDistance=50`
- **Response**: Available delivery requests for driver

### Accept Delivery Request
- **POST** `/api/delivery/:id/accept` *(Driver Only)*
- **Response**: Delivery assignment confirmation

### Update Delivery Status
- **PUT** `/api/delivery/:id/status` *(Driver Only)*
- **Body**: `{ status, actualPickupTime, actualDeliveryTime }`
- **Response**: Delivery status update confirmation

### Get Driver Deliveries
- **GET** `/api/delivery/my-deliveries` *(Driver Only)*
- **Query**: `?status=ASSIGNED&page=1&limit=10`
- **Response**: Driver's assigned deliveries

### Track Delivery
- **GET** `/api/delivery/track/:trackingNumber`
- **Response**: Real-time delivery tracking information

### Get Delivery Statistics
- **GET** `/api/delivery/stats` *(Driver Only)*
- **Response**: Driver's delivery performance metrics

### Get Driver Earnings
- **GET** `/api/delivery/earnings` *(Driver Only)*
- **Query**: `?period=month`
- **Response**: Driver's earnings breakdown

### Request Driver Payout
- **POST** `/api/delivery/request-payout` *(Driver Only)*
- **Body**: `{ amount, bankDetails }`
- **Response**: Payout request confirmation

### Get Delivery Route
- **GET** `/api/delivery/:id/route` *(Driver Only)*
- **Response**: Optimized delivery route information

### Add Delivery Review
- **POST** `/api/delivery/:id/review` *(Auth Required)*
- **Body**: `{ rating, comment }`
- **Response**: Delivery review confirmation

---

## Driver Management

### Get Driver Dashboard
- **GET** `/api/drivers/dashboard` *(Driver Only)*
- **Response**: Driver metrics, active orders, earnings

### Update Driver Status
- **PUT** `/api/drivers/status` *(Driver Only)*
- **Body**: `{ isOnline, isAvailable, currentLocation }`
- **Response**: Driver status update confirmation

### Accept Order
- **POST** `/api/drivers/orders/accept` *(Driver Only)*
- **Body**: `{ orderId, estimatedDeliveryTime }`
- **Response**: Order acceptance confirmation

### Get Available Orders
- **GET** `/api/drivers/orders/available` *(Driver Only)*
- **Response**: Orders available for pickup

---

## Auto Assignment System

### Request Driver Assignment
- **POST** `/api/auto-assignment/:orderId/request-assignment` *(Auth Required)*
- **Response**: Driver assignment result

### Get Assignment Status
- **GET** `/api/auto-assignment/:orderId/assignment-status` *(Auth Required)*
- **Response**: Current assignment status

---

## Geographic Services

### Check Service Areas
- **GET** `/api/geo/service-areas`
- **Query**: `?latitude=6.5244&longitude=3.3792&serviceType=delivery`
- **Response**: Service availability in location

### Estimate Delivery Time
- **POST** `/api/geo/estimate-delivery`
- **Body**: `{ pickupLocation, deliveryLocation, deliveryType, timeOfDay, packageSize }`
- **Response**: Delivery time and cost estimates

### Find Nearby Services
- **GET** `/api/geo/nearby-services` *(Auth Required)*
- **Query**: `?latitude=6.5244&longitude=3.3792&radius=10&category=restaurant&limit=20`
- **Response**: Nearby merchants and services

### Optimize Route
- **POST** `/api/geo/optimize-route` *(Driver Only)*
- **Body**: `{ deliveryPoints, startLocation }`
- **Response**: Optimized delivery route

---

## Communication Systems

### Chat System

#### Start Conversation
- **POST** `/api/chat/conversations` *(Auth Required)*
- **Body**: `{ customerId, vendorId, productId, conversationType }`
- **Response**: New conversation details

#### Get User Conversations
- **GET** `/api/chat/conversations` *(Auth Required)*
- **Query**: `?page=1&limit=20`
- **Response**: User's conversation list

#### Send Message
- **POST** `/api/chat/conversations/:id/messages` *(Auth Required)*
- **Body**: `{ content, messageType, attachedData }`
- **Response**: Sent message confirmation

#### Get Conversation Messages
- **GET** `/api/chat/conversations/:id/messages` *(Auth Required)*
- **Query**: `?page=1&limit=50`
- **Response**: Conversation message history

#### Get Conversation Details
- **GET** `/api/chat/conversations/:id` *(Auth Required)*
- **Response**: Detailed conversation information

#### Get Online Users in Conversation
- **GET** `/api/chat/conversations/:id/online-users` *(Auth Required)*
- **Response**: Online participant status

#### Get User Online Status
- **GET** `/api/chat/users/:userId/status` *(Auth Required)*
- **Response**: User's online/offline status

#### Close Conversation
- **PUT** `/api/chat/conversations/:id/close` *(Auth Required)*
- **Response**: Conversation closure confirmation

### Live Chat System

#### Start Live Chat
- **POST** `/api/live-chat/conversations` *(Auth Required)*
- **Body**: `{ subject, message, priority }`
- **Response**: Live chat session details

#### Get Live Chat Conversations
- **GET** `/api/live-chat/conversations` *(Auth Required)*
- **Query**: `?status=active&limit=20`
- **Response**: User's live chat sessions

#### Get Live Chat Messages
- **GET** `/api/live-chat/conversations/:id/messages` *(Auth Required)*
- **Response**: Live chat message history

#### Send Live Chat Message
- **POST** `/api/live-chat/conversations/:id/messages` *(Auth Required)*
- **Body**: `{ content, messageType }`
- **Response**: Message sent confirmation

#### Admin: Get All Conversations
- **GET** `/api/live-chat/admin/conversations` *(Admin Only)*
- **Query**: `?status=ACTIVE&priority=HIGH&limit=50`
- **Response**: All active chat sessions

#### Admin: Assign Conversation
- **POST** `/api/live-chat/admin/conversations/:id/assign` *(Admin Only)*
- **Body**: `{ agentId }`
- **Response**: Assignment confirmation

#### Admin: Close Conversation
- **POST** `/api/live-chat/admin/conversations/:id/close` *(Admin Only)*
- **Body**: `{ resolution }`
- **Response**: Closure confirmation

---

## Social Features

### Create Post
- **POST** `/api/social/posts` *(Merchant Only)*
- **Body**: `{ title, content, postType, productId, images, tags, originalPrice, discountPrice, validUntil }`
- **Response**: Created post details

### Get Posts Feed
- **GET** `/api/social/posts`
- **Query**: `?page=1&limit=10&vendorId=1&postType=PROMOTION`
- **Response**: Social media feed

### Get Single Post
- **GET** `/api/social/posts/:id`
- **Response**: Detailed post information

### Like/Unlike Post
- **POST** `/api/social/posts/:id/like` *(Auth Required)*
- **Response**: Like status update

### Add Comment to Post
- **POST** `/api/social/posts/:id/comments` *(Auth Required)*
- **Body**: `{ content }`
- **Response**: Comment creation confirmation

### Get Post Comments
- **GET** `/api/social/posts/:id/comments`
- **Query**: `?page=1&limit=20`
- **Response**: Post comments list

### Update Post
- **PUT** `/api/social/posts/:id` *(Post Owner Only)*
- **Body**: Post update fields
- **Response**: Updated post details

### Delete Post
- **DELETE** `/api/social/posts/:id` *(Post Owner Only)*
- **Response**: Post deletion confirmation

---

## Reviews & Ratings

### Create Review
- **POST** `/api/reviews` *(Auth Required)*
- **Body**: `{ targetType, targetId, orderId, rating, comment }`
- **Response**: Review creation confirmation

### Get Product Reviews
- **GET** `/api/reviews/product/:productId`
- **Query**: `?page=1&limit=10&rating=5`
- **Response**: Product review list + statistics

### Get User Reviews
- **GET** `/api/reviews/user/:userId`
- **Query**: `?page=1&limit=10`
- **Response**: Reviews written by user

### Update Review
- **PUT** `/api/reviews/:reviewId` *(Auth Required)*
- **Body**: `{ rating, comment }`
- **Response**: Updated review details

### Delete Review
- **DELETE** `/api/reviews/:reviewId` *(Auth Required)*
- **Response**: Review deletion confirmation

---

## Search & Discovery

### Search Products
- **GET** `/api/search/products`
- **Query**: `?q=phone&category=1&minPrice=100&maxPrice=1000&rating=4&sortBy=price&sortOrder=asc&page=1&limit=20`
- **Response**: Filtered product search results

### Search Merchants
- **GET** `/api/search/merchants`
- **Query**: `?q=restaurant&location=Lagos&category=food&page=1&limit=20`
- **Response**: Merchant search results

### Get Trending Searches
- **GET** `/api/search/trending`
- **Query**: `?limit=10`
- **Response**: Popular search terms

### Save Search Query
- **POST** `/api/search/save` *(Auth Required)*
- **Body**: `{ query }`
- **Response**: Search save confirmation

### Get Search History
- **GET** `/api/search/history` *(Auth Required)*
- **Query**: `?page=1&limit=20`
- **Response**: User's search history

### Get Search Suggestions
- **GET** `/api/search/suggestions`
- **Query**: `?q=partial_query`
- **Response**: Auto-complete suggestions

---

## Notifications

### Get User Notifications
- **GET** `/api/notifications` *(Auth Required)*
- **Query**: `?isRead=false&type=ORDER_UPDATE&page=1&limit=20`
- **Response**: User's notification list

### Mark Notification as Read
- **PUT** `/api/notifications/:id/read` *(Auth Required)*
- **Response**: Read status update

### Mark All Notifications as Read
- **PUT** `/api/notifications/mark-all-read` *(Auth Required)*
- **Response**: Bulk read confirmation

### Get Unread Count
- **GET** `/api/notifications/unread-count` *(Auth Required)*
- **Response**: Unread notification count

### Create Notification
- **POST** `/api/notifications` *(Auth Required)*
- **Body**: `{ title, message, type, targetUserId }`
- **Response**: Notification creation confirmation

### Delete Notification
- **DELETE** `/api/notifications/:id` *(Auth Required)*
- **Response**: Notification deletion confirmation

---

## Analytics & Reporting

### Get Merchant Dashboard Analytics
- **GET** `/api/analytics/dashboard` *(Merchant Only)*
- **Query**: `?startDate=2024-01-01&endDate=2024-12-31`
- **Response**: Comprehensive business metrics

### Get Sales Analytics
- **GET** `/api/analytics/sales` *(Merchant Only)*
- **Query**: `?period=month&startDate=2024-01-01&endDate=2024-12-31`
- **Response**: Sales performance data

### Record Daily Analytics
- **POST** `/api/analytics/record-daily` *(Merchant Only)*
- **Response**: Daily metrics recording confirmation

### Get Merchant Profile Analytics
- **GET** `/api/analytics/profile` *(Merchant Only)*
- **Response**: Profile performance metrics

### Real-time Analytics

#### Get Dashboard Statistics
- **GET** `/api/realtime/dashboard/stats` *(Auth Required)*
- **Response**: Live dashboard metrics

#### Get User by ID
- **GET** `/api/realtime/users/:id` *(Auth Required)*
- **Response**: User details

#### Get Users by Role
- **GET** `/api/realtime/users/role/:role` *(Auth Required)*
- **Query**: `?limit=50`
- **Response**: Users filtered by role

#### Get Active Products
- **GET** `/api/realtime/products/active`
- **Query**: `?limit=100`
- **Response**: Currently active products

#### Get Products by Seller
- **GET** `/api/realtime/products/seller/:sellerId`
- **Response**: Seller's product catalog

#### Get Orders by User
- **GET** `/api/realtime/orders/user/:userId` *(Auth Required)*
- **Query**: `?limit=50`
- **Response**: User's order history

#### Get Orders by Status
- **GET** `/api/realtime/orders/status/:status` *(Auth Required)*
- **Query**: `?limit=100`
- **Response**: Orders filtered by status

#### Get User Recent Activity
- **GET** `/api/realtime/activity/user/:userId` *(Auth Required)*
- **Query**: `?hours=24`
- **Response**: User's recent activity

#### Get Active Fraud Alerts
- **GET** `/api/realtime/security/fraud-alerts` *(Auth Required)*
- **Query**: `?limit=100`
- **Response**: Active security alerts

---

## Business Management

### Business Categories

#### Get All Business Categories
- **GET** `/api/business-categories`
- **Response**: All business category types

#### Get Commodity Categories
- **GET** `/api/business-categories/:businessCategoryId/commodities`
- **Response**: Commodities within business category

#### Create Business Category
- **POST** `/api/business-categories` *(Admin Only)*
- **Body**: `{ name, imageUrl }`
- **Response**: Created category details

#### Create Commodity Category
- **POST** `/api/business-categories/:businessCategoryId/commodities` *(Admin Only)*
- **Body**: `{ name }`
- **Response**: Created commodity category

### Opening Hours

#### Get Vendor Opening Hours
- **GET** `/api/opening-hours/:vendorId`
- **Response**: Weekly schedule information

#### Set Vendor Opening Hours
- **POST** `/api/opening-hours` *(Merchant Only)*
- **Body**: `{ schedule: [{ dayOfWeek, openTime, closeTime }] }`
- **Response**: Schedule update confirmation

#### Update Specific Day Hours
- **PUT** `/api/opening-hours/:dayOfWeek` *(Merchant Only)*
- **Body**: `{ openTime, closeTime }`
- **Response**: Day schedule update

### Commodity Management

#### Get Commodity Subcategories
- **GET** `/api/commodities/subcategories`
- **Query**: `?search=rice`
- **Response**: Available commodity types

#### Add Commodity
- **POST** `/api/commodities/add` *(Merchant Only)*
- **Body**: `{ name, description, price, unit, categoryId, image, minimumOrder, quantity }`
- **Response**: Created commodity details

#### Update Commodity
- **POST** `/api/commodities/update/:id` *(Merchant Only)*
- **Body**: Commodity update fields
- **Response**: Updated commodity details

#### Remove Commodity
- **DELETE** `/api/commodities/remove/:id` *(Merchant Only)*
- **Response**: Commodity removal confirmation

#### Get All Commodities
- **GET** `/api/commodities/all` *(Auth Required)*
- **Response**: All available commodities

#### Get Commodity Details
- **GET** `/api/commodities/:id` *(Auth Required)*
- **Response**: Detailed commodity information

#### Get Vendor Commodities
- **GET** `/api/commodities/vendor/:vendorId` *(Auth Required)*
- **Query**: `?page=1&limit=10`
- **Response**: Vendor's commodity catalog

---

## Fuel Services

### Fuel Orders

#### Place Fuel Order
- **POST** `/api/fuel/order` *(Auth Required)*
- **Body**: `{ inventoryId, orderType, quantity, deliveryAddress, deliveryDate, specialInstructions }`
- **Response**: Fuel order confirmation + receipt

#### Get Fuel Orders
- **GET** `/api/fuel/orders` *(Auth Required)*
- **Query**: `?page=1&limit=10&status=PENDING&orderType=BULK`
- **Response**: User's fuel order history

#### Get Fuel Order Details
- **GET** `/api/fuel/orders/:id` *(Auth Required)*
- **Response**: Detailed fuel order information

#### Cancel Fuel Order
- **PUT** `/api/fuel/orders/:id/cancel` *(Auth Required)*
- **Response**: Cancellation confirmation

### Fuel Inventory

#### Get Fuel Inventory
- **GET** `/api/fuel/inventory`
- **Query**: `?fuelType=PETROL&merchantId=1`
- **Response**: Available fuel inventory

#### Add Fuel Inventory
- **POST** `/api/fuel/inventory` *(Merchant Only)*
- **Body**: `{ fuelType, quantity, unit, pricePerUnit, minimumOrderQuantity }`
- **Response**: Inventory addition confirmation

#### Update Fuel Inventory
- **PUT** `/api/fuel/inventory/:id` *(Merchant Only)*
- **Body**: Inventory update fields
- **Response**: Updated inventory details

### Merchant Fuel Operations

#### Get Merchant Fuel Orders
- **GET** `/api/fuel/merchant/orders` *(Merchant Only)*
- **Query**: `?page=1&limit=10&status=PENDING`
- **Response**: Merchant's received fuel orders

#### Update Fuel Order Status
- **PUT** `/api/fuel/merchant/orders/:id/status` *(Merchant Only)*
- **Body**: `{ status, estimatedDeliveryTime }`
- **Response**: Status update confirmation

---

## Toll Services

### Toll Operations

#### Make Toll Payment
- **POST** `/api/toll/pay` *(Auth Required)*
- **Body**: `{ locationId, vehicleType, vehiclePlate, paymentMethod }`
- **Response**: Payment confirmation + QR receipt

#### Get Toll Locations
- **GET** `/api/toll/locations`
- **Response**: Available toll gate locations

#### Get Toll Pricing
- **GET** `/api/toll/pricing/:locationId`
- **Query**: `?vehicleType=CAR`
- **Response**: Pricing information for location

#### Get Payment History
- **GET** `/api/toll/history` *(Auth Required)*
- **Query**: `?page=1&limit=20`
- **Response**: User's toll payment history

#### Get Toll Receipt
- **GET** `/api/toll/receipt/:receiptNumber`
- **Response**: Digital toll receipt

---

## Verification Services

### User Verification

#### Submit Identity Verification
- **POST** `/api/verification/identity` *(Auth Required)*
- **Body**: `{ faceImageUrl }`
- **Response**: Verification submission confirmation

#### Submit Driver Verification
- **POST** `/api/verification/driver` *(Driver Only)*
- **Body**: `{ licenseNumber, licenseExpiryDate, licenseImageUrl, vehicleType, vehiclePlate, vehicleModel, vehicleYear }`
- **Response**: Driver verification submission

#### Submit Phone Verification
- **POST** `/api/verification/phone` *(Auth Required)*
- **Body**: `{ phoneNumber }`
- **Response**: OTP sent for phone verification

#### Verify Phone with OTP
- **POST** `/api/verification/phone/verify` *(Auth Required)*
- **Body**: `{ phoneNumber, otp }`
- **Response**: Phone verification confirmation

#### Get Verification Status
- **GET** `/api/verification/status` *(Auth Required)*
- **Response**: User's verification status across all types

---

## Document & Upload Services

### Receipt Management

#### Generate Receipt
- **POST** `/api/receipts/generate` *(Auth Required)*
- **Body**: `{ orderId, paymentMethod, transactionRef, driverId, metadata }`
- **Response**: Generated receipt with QR code

#### Get Receipt Details
- **GET** `/api/receipts/:receiptNumber`
- **Response**: Receipt information + download links

#### Get User's Receipts
- **GET** `/api/receipts/user/all` *(Auth Required)*
- **Query**: `?page=1&limit=20`
- **Response**: User's receipt history

#### Get Merchant Receipts
- **GET** `/api/receipts/merchant/all` *(Merchant Only)*
- **Query**: `?page=1&limit=20`
- **Response**: Merchant's issued receipts

#### Update Receipt
- **PUT** `/api/receipts/:id/update` *(Auth Required)*
- **Body**: Receipt update fields
- **Response**: Updated receipt details

### Upload Services

#### Upload Single Image
- **POST** `/api/upload/image` *(Auth Required)*
- **Form Data**: `image` file
- **Response**: Uploaded image URL

#### Upload Multiple Images
- **POST** `/api/upload/images` *(Auth Required)*
- **Form Data**: `images` files (max 5)
- **Response**: Array of uploaded image URLs

#### Upload Document
- **POST** `/api/upload/document` *(Auth Required)*
- **Form Data**: `document` file
- **Response**: Uploaded document URL

#### Get File Info
- **GET** `/api/upload/file-info`
- **Query**: `?type=images&filename=image.jpg`
- **Response**: File metadata and access info

#### Delete File
- **DELETE** `/api/upload/delete`
- **Body**: `{ filename, type }`
- **Response**: File deletion confirmation

---

## Support System

### Support Tickets

#### Create Support Ticket
- **POST** `/api/support/tickets`
- **Body**: `{ name, email, subject, message, priority }`
- **Response**: Ticket creation + tracking number

#### Get User's Support Tickets
- **GET** `/api/support/tickets` *(Auth Required)*
- **Query**: `?status=OPEN&page=1&limit=10`
- **Response**: User's support ticket history

#### Get Ticket Details
- **GET** `/api/support/tickets/:id`
- **Query**: `?email=user@example.com` (if not authenticated)
- **Response**: Detailed ticket information

#### Update Ticket (Admin)
- **PUT** `/api/support/tickets/:id` *(Admin Only)*
- **Body**: `{ status, priority, assignedTo, adminNotes, resolution }`
- **Response**: Ticket update confirmation

#### Get All Tickets (Admin)
- **GET** `/api/support/admin/tickets` *(Admin Only)*
- **Query**: `?status=OPEN&priority=HIGH&page=1&limit=20`
- **Response**: All support tickets with filters

#### Get Support Statistics (Admin)
- **GET** `/api/support/admin/stats` *(Admin Only)*
- **Response**: Support system metrics

---

## Security & Fraud Detection

### Security Logs

#### Log Security Event
- **POST** `/api/security/log`
- **Body**: `{ userId, action, details, ipAddress, userAgent, severity }`
- **Response**: Security log confirmation

#### Get Security Logs
- **GET** `/api/security/logs/:userId`
- **Query**: `?limit=50&severity=HIGH`
- **Response**: User's security event history

#### Report Suspicious Activity
- **POST** `/api/security/suspicious`
- **Body**: `{ userId, activityType, description, riskIndicators, ipAddress, deviceFingerprint }`
- **Response**: Suspicious activity report confirmation

#### Manage Trusted Devices
- **POST** `/api/security/trusted-device`
- **Body**: `{ userId, deviceToken, deviceName, deviceType, browserInfo, expiresAt }`
- **Response**: Trusted device registration

#### Enable 2FA
- **POST** `/api/security/enable-2fa`
- **Body**: `{ userId, secret, backupCodes }`
- **Response**: 2FA activation confirmation

#### Disable 2FA
- **POST** `/api/security/disable-2fa`
- **Body**: `{ userId }`
- **Response**: 2FA deactivation confirmation

### Fraud Detection

#### Get Fraud Alerts
- **GET** `/api/fraud/alerts` *(Admin Only)*
- **Query**: `?severity=HIGH&status=ACTIVE&type=PAYMENT&page=1&limit=20`
- **Response**: Filtered fraud alert list

#### Get Fraud Statistics
- **GET** `/api/fraud/stats` *(Admin Only)*
- **Response**: Fraud detection system metrics

#### Get Suspicious Activities
- **GET** `/api/fraud/activities` *(Admin Only)*
- **Response**: Recent suspicious activity reports

#### Investigate Alert
- **POST** `/api/fraud/alerts/:alertId/investigate` *(Admin Only)*
- **Body**: `{ reason }`
- **Response**: Investigation initiation confirmation

#### Resolve Alert
- **POST** `/api/fraud/alerts/:alertId/resolve` *(Admin Only)*
- **Body**: `{ reason }`
- **Response**: Alert resolution confirmation

#### Flag User Account
- **POST** `/api/fraud/users/:userId/flag` *(Admin Only)*
- **Body**: `{ reason, severity }`
- **Response**: Account flagging confirmation

#### Bulk Actions on Alerts
- **POST** `/api/fraud/alerts/bulk-action` *(Admin Only)*
- **Body**: `{ alertIds, action, reason }`
- **Response**: Bulk operation confirmation

---

## Content Moderation

### Moderation Reports

#### Get Moderation Reports
- **GET** `/api/moderation/reports` *(Admin Only)*
- **Query**: `?page=1&limit=20&status=PENDING&contentType=POST&priority=HIGH`
- **Response**: Content moderation queue

#### Take Action on Report
- **POST** `/api/moderation/reports/:id/action` *(Admin Only)*
- **Body**: `{ action, reason, notifyUser }`
- **Response**: Moderation action confirmation

#### Bulk Action on Reports
- **POST** `/api/moderation/reports/bulk-action` *(Admin Only)*
- **Body**: `{ reportIds, action, reason }`
- **Response**: Bulk moderation confirmation

#### Get Moderation Statistics
- **GET** `/api/moderation/stats` *(Admin Only)*
- **Response**: Content moderation metrics

---

## System Monitoring

### System Health

#### System Health Check
- **GET** `/api/system/health` *(Admin Only)*
- **Response**: System health status + metrics

#### Real-time Metrics
- **GET** `/api/system/metrics/realtime` *(Admin Only)*
- **Response**: Live system performance data

#### Performance Metrics
- **GET** `/api/system/performance` *(Admin Only)*
- **Response**: System performance analytics

#### Error Logs
- **GET** `/api/system/errors` *(Admin Only)*
- **Query**: `?limit=50&severity=ERROR&startDate=2024-01-01&endDate=2024-12-31`
- **Response**: System error log entries

#### Database Backup
- **POST** `/api/system/maintenance/backup` *(Admin Only)*
- **Response**: Backup initiation confirmation

---

## Testing & Development

### Email Testing

#### Test SMTP Configuration
- **POST** `/api/test-email/test-smtp`
- **Body**: `{ email, type }`
- **Response**: Email sending test result

#### Check SMTP Configuration
- **GET** `/api/test-email/smtp-config`
- **Response**: Current email configuration status

### Validation Testing

#### Test Validation Functions
- **POST** `/api/test-validation/test-validation`
- **Response**: Validation function test results

#### Test Database Connection
- **GET** `/api/test-validation/test-db`
- **Response**: Database connectivity status

#### Test Fraud Detection
- **POST** `/api/test-validation/test-fraud-detection` *(Auth Required)*
- **Response**: Fraud detection system test results

---

## Error Codes & Status Responses

### HTTP Status Codes Used

- **200** - Success
- **201** - Created
- **400** - Bad Request (validation errors)
- **401** - Unauthorized (authentication required)
- **403** - Forbidden (insufficient permissions)
- **404** - Not Found
- **409** - Conflict (duplicate data)
- **500** - Internal Server Error

### Standard Response Format

#### Success Response
```json
{
  "status": "Success",
  "message": "Operation completed successfully",
  "data": { ... }
}
```

#### Error Response
```json
{
  "error": "Error description",
  "details": "Additional error information"
}
```

#### Paginated Response
```json
{
  "status": "Success",
  "data": { ... },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

---

## Authentication & Authorization

### JWT Token Required Endpoints
All endpoints marked with *(Auth Required)* need JWT token in header:
```
Authorization: Bearer <jwt_token>
```

### Role-Based Access Control
- **CONSUMER** - Basic user access
- **MERCHANT** - Business user access + consumer access
- **DRIVER** - Delivery driver access + consumer access  
- **ADMIN** - Full system administration access

### Rate Limiting
- General API: 100 requests per 15 minutes
- Auth endpoints: 5 requests per 15 minutes
- Upload endpoints: 10 requests per minute

---

This documentation covers all implemented API endpoints in the BrillPrime backend system. Each endpoint includes the HTTP method, URL pattern, required authentication, request/response format, and any special permissions needed.
