import { pgTable, text, serial, integer, boolean, timestamp, decimal, uuid, json, jsonb, varchar, pgEnum, unique, time } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
import { sql, eq, and, desc, ne, isNull, or } from 'drizzle-orm';
import { transactions } from './index';

// Define an enum for user roles if it's not defined elsewhere
const roleEnum = pgEnum("role", ["CONSUMER", "MERCHANT", "DRIVER", "ADMIN"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 50 }).notNull().unique(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  phone: varchar("phone", { length: 20 }),
  password: varchar("password", { length: 255 }), // Password can be null for social auth
  role: roleEnum("role").notNull().default("CONSUMER"),
  profilePicture: text("profile_picture"),
  isVerified: boolean("is_verified").default(false),
  isPhoneVerified: boolean("is_phone_verified").default(false),
  isIdentityVerified: boolean("is_identity_verified").default(false),
  isActive: boolean("is_active").default(true),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  country: varchar("country", { length: 100 }).default('Nigeria'),
  latitude: decimal('latitude', { precision: 10, scale: 8 }),
  longitude: decimal('longitude', { precision: 11, scale: 8 }),
  address: text('address'),
  bio: text('bio'),
  socialAuth: jsonb('social_auth'),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const otpCodes = pgTable("otp_codes", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  isUsed: boolean("is_used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userLocations = pgTable('user_locations', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: decimal("longitude", { precision: 11, scale: 8 }).notNull(),
  address: text("address"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Categories table
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  icon: varchar('icon', { length: 255 }),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  description: text('description'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Business Categories table
export const businessCategories = pgTable('business_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  imageUrl: varchar('image_url', { length: 500 }),
  isDeleted: boolean('is_deleted').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

// Commodity Categories table
export const commodityCategories = pgTable('commodity_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  businessCategoryId: uuid('business_category_id').notNull().references(() => businessCategories.id),
  isDeleted: boolean('is_deleted').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

// Opening Hours table
export const openingHours = pgTable('opening_hours', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: integer('vendor_id').notNull().references(() => users.id),
  dayOfWeek: varchar('day_of_week', { length: 20 }),
  openTime: varchar('open_time', { length: 10 }),
  closeTime: varchar('close_time', { length: 10 }),
  isDeleted: boolean('is_deleted').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  uniqueVendorDay: unique().on(table.vendorId, table.dayOfWeek),
}));

// Search functionality tables
export const searchHistory = pgTable('search_history', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  searchQuery: varchar('search_query', { length: 255 }).notNull(),
  searchType: varchar('search_type', { length: 50 }).default('GENERAL'),
  resultsCount: integer('results_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

export const trendingSearches = pgTable('trending_searches', {
  id: uuid('id').primaryKey().defaultRandom(),
  searchTerm: varchar('search_term', { length: 255 }).notNull(),
  searchCount: integer('search_count').default(1),
  lastSearched: timestamp('last_searched').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Reviews functionality tables
export const reviews = pgTable('reviews', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  targetType: varchar('target_type', { length: 20 }).notNull(), // PRODUCT, MERCHANT, DRIVER
  targetId: integer('target_id').notNull(),
  orderId: integer('order_id').references(() => orders.id),
  rating: integer('rating').notNull(),
  comment: text('comment'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const reviewResponses = pgTable('review_responses', {
  id: uuid('id').primaryKey().defaultRandom(),
  reviewId: uuid('review_id').references(() => reviews.id).notNull(),
  sellerId: integer('seller_id').references(() => users.id).notNull(),
  response: text('response').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Products table
export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  price: varchar('price', { length: 20 }).notNull(),
  quantity: integer('quantity').notNull().default(0),
  unit: varchar('unit', { length: 50 }),
  categoryId: integer('category_id').references(() => categories.id),
  vendorId: integer('vendor_id').notNull().references(() => users.id),
  sellerId: integer('seller_id').notNull().references(() => users.id),
  image: text('image'),
  images: json('images'),
  rating: varchar('rating', { length: 10 }).default('0'),
  reviewCount: integer('review_count').default(0),
  inStock: boolean('in_stock').default(true),
  isActive: boolean('is_active').default(true),
  minimumOrder: integer('minimum_order').default(1),
  maximumOrder: integer('maximum_order'),
  weight: decimal('weight', { precision: 8, scale: 2 }),
  dimensions: json('dimensions'),
  tags: json('tags'),
  discountPrice: varchar('discount_price', { length: 20 }),
  discountPercentage: integer('discount_percentage'),
  availableFrom: timestamp('available_from'),
  availableUntil: timestamp('available_until'),
  featured: boolean('featured').default(false),
  seoTitle: varchar('seo_title', { length: 255 }),
  seoDescription: text('seo_description'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Orders table
export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  buyerId: integer('buyer_id').notNull().references(() => users.id),
  sellerId: integer('seller_id').notNull().references(() => users.id),
  productId: uuid('product_id').notNull().references(() => products.id),
  quantity: integer('quantity').notNull(),
  totalPrice: varchar('total_price', { length: 20 }).notNull(),
  status: varchar('status', { length: 50 }).default('pending'),
  paymentStatus: varchar('payment_status', { length: 50 }).default('pending'),
  paymentTxRef: varchar('payment_tx_ref', { length: 255 }),
  deliveryAddress: text('delivery_address'),
  specialInstructions: text('special_instructions'),
  estimatedDeliveryDate: timestamp('estimated_delivery_date'),
  actualDeliveryDate: timestamp('actual_delivery_date'),
  driverId: integer('driver_id').references(() => users.id),
  trackingNumber: varchar('tracking_number', { length: 100 }),
  orderNotes: text('order_notes'),
  cancelReason: text('cancel_reason'),
  refundAmount: varchar('refund_amount', { length: 20 }),
  refundStatus: varchar('refund_status', { length: 50 }),
  metadata: json('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Cart Items table
export const cartItems = pgTable('cart_items', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  productId: uuid('product_id').notNull().references(() => products.id),
  quantity: integer('quantity').notNull().default(1),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Merchant Profiles table
export const merchantProfiles = pgTable('merchant_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: integer('user_id').notNull().references(() => users.id),
  businessName: varchar('business_name', { length: 255 }),
  businessType: varchar('business_type', { length: 100 }),
  businessDescription: text('business_description'),
  businessAddress: text('business_address'),
  businessPhone: varchar('business_phone', { length: 20 }),
  businessEmail: varchar('business_email', { length: 255 }),
  businessWebsite: varchar('business_website', { length: 255 }),
  businessHours: json('business_hours'),
  socialMedia: json('social_media'),
  businessLicense: varchar('business_license', { length: 255 }),
  taxNumber: varchar('tax_number', { length: 100 }),
  bankDetails: json('bank_details'),
  isVerified: boolean('is_verified').default(false),
  verificationStatus: varchar('verification_status', { length: 50 }).default('PENDING'),
  verificationNotes: text('verification_notes'),
  rating: decimal('rating', { precision: 3, scale: 2 }).default('0.00'),
  reviewCount: integer('review_count').default(0),
  totalSales: decimal('total_sales', { precision: 12, scale: 2 }).default('0.00'),
  commissionRate: decimal('commission_rate', { precision: 5, scale: 2 }).default('5.00'),
  businessCategoryId: uuid('business_category_id').references(() => businessCategories.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Driver Profiles table
export const driverProfiles = pgTable('driver_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: integer('user_id').notNull().references(() => users.id),
  licenseNumber: varchar('license_number', { length: 50 }),
  licenseExpiry: timestamp('license_expiry'),
  vehicleType: varchar('vehicle_type', { length: 50 }),
  vehiclePlate: varchar('vehicle_plate', { length: 20 }),
  vehicleModel: varchar('vehicle_model', { length: 100 }),
  vehicleYear: integer('vehicle_year'),
  vehicleColor: varchar('vehicle_color', { length: 50 }),
  vehicleDocuments: json('vehicle_documents'),
  driverTier: varchar('driver_tier', { length: 20 }).default('STANDARD'),
  isAvailable: boolean('is_available').default(false),
  isActive: boolean('is_active').default(true),
  currentLatitude: decimal('current_latitude', { precision: 10, scale: 8 }),
  currentLongitude: decimal('current_longitude', { precision: 11, scale: 8 }),
  serviceTypes: json('service_types'),
  maxCargoValue: decimal('max_cargo_value', { precision: 10, scale: 2 }),
  rating: decimal('rating', { precision: 3, scale: 2 }).default('0.00'),
  completedDeliveries: integer('completed_deliveries').default(0),
  totalEarnings: decimal('total_earnings', { precision: 12, scale: 2 }).default('0.00'),
  onlineHours: decimal('online_hours', { precision: 8, scale: 2 }).default('0.00'),
  isVerified: boolean('is_verified').default(false),
  verificationStatus: varchar('verification_status', { length: 50 }).default('PENDING'),
  backgroundCheckStatus: varchar('background_check_status', { length: 50 }).default('PENDING'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Receipts table
export const receipts = pgTable('receipts', {
  id: uuid('id').primaryKey().defaultRandom(),
  receiptNumber: varchar('receipt_number', { length: 100 }).notNull().unique(),
  orderId: uuid('order_id').notNull().references(() => orders.id),
  customerId: integer('customer_id').notNull().references(() => users.id),
  merchantId: integer('merchant_id').notNull().references(() => users.id),
  driverId: integer('driver_id').references(() => users.id),
  totalAmount: varchar('total_amount', { length: 20 }).notNull(),
  paymentMethod: varchar('payment_method', { length: 50 }).notNull(),
  paymentStatus: varchar('payment_status', { length: 50 }).default('PENDING'),
  transactionRef: varchar('transaction_ref', { length: 255 }),
  qrCodeData: text('qr_code_data'),
  qrCodeImageUrl: varchar('qr_code_image_url', { length: 500 }),
  receiptPdfUrl: varchar('receipt_pdf_url', { length: 500 }),
  deliveryStatus: varchar('delivery_status', { length: 50 }).default('PENDING'),
  merchantVerifiedAt: timestamp('merchant_verified_at'),
  merchantVerifiedBy: integer('merchant_verified_by').references(() => users.id),
  deliveryVerifiedAt: timestamp('delivery_verified_at'),
  deliveryVerifiedBy: integer('delivery_verified_by').references(() => users.id),
  adminVerifiedAt: timestamp('admin_verified_at'),
  adminVerifiedBy: integer('admin_verified_by').references(() => users.id),
  metadata: json('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Notifications tables
export const merchantNotifications = pgTable('merchant_notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  merchantId: integer('merchant_id').notNull().references(() => users.id),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  type: varchar('type', { length: 50 }).default('GENERAL'),
  relatedId: varchar('related_id', { length: 255 }),
  priority: varchar('priority', { length: 20 }).default('MEDIUM'),
  actionUrl: varchar('action_url', { length: 500 }),
  isRead: boolean('is_read').default(false),
  readAt: timestamp('read_at'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const consumerNotifications = pgTable('consumer_notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  consumerId: integer('consumer_id').notNull().references(() => users.id),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  type: varchar('type', { length: 50 }).default('GENERAL'),
  relatedId: varchar('related_id', { length: 255 }),
  priority: varchar('priority', { length: 20 }).default('MEDIUM'),
  actionUrl: varchar('action_url', { length: 500 }),
  isRead: boolean('is_read').default(false),
  readAt: timestamp('read_at'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const driverNotifications = pgTable('driver_notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  driverId: integer('driver_id').notNull().references(() => users.id),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  type: varchar('type', { length: 50 }).default('GENERAL'),
  relatedId: varchar('related_id', { length: 255 }),
  priority: varchar('priority', { length: 20 }).default('MEDIUM'),
  actionUrl: varchar('action_url', { length: 500 }),
  isRead: boolean('is_read').default(false),
  readAt: timestamp('read_at'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Add missing tables for comprehensive functionality
export const deliveryRequests = pgTable('delivery_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: integer('customer_id').notNull().references(() => users.id),
  merchantId: integer('merchant_id').references(() => users.id),
  driverId: integer('driver_id').references(() => users.id),
  orderId: uuid('order_id').references(() => orders.id),
  deliveryType: varchar('delivery_type', { length: 50 }).notNull(),
  cargoValue: varchar('cargo_value', { length: 20 }).default('0'),
  requiresPremiumDriver: boolean('requires_premium_driver').default(false),
  pickupAddress: text('pickup_address').notNull(),
  deliveryAddress: text('delivery_address').notNull(),
  estimatedDistance: varchar('estimated_distance', { length: 20 }),
  estimatedDuration: integer('estimated_duration'),
  deliveryFee: varchar('delivery_fee', { length: 20 }).notNull(),
  scheduledPickupTime: timestamp('scheduled_pickup_time'),
  actualPickupTime: timestamp('actual_pickup_time'),
  actualDeliveryTime: timestamp('actual_delivery_time'),
  specialInstructions: text('special_instructions'),
  trackingNumber: varchar('tracking_number', { length: 100 }),
  status: varchar('status', { length: 50 }).default('PENDING'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: integer('customer_id').notNull().references(() => users.id),
  vendorId: integer('vendor_id').references(() => users.id),
  productId: uuid('product_id').references(() => products.id),
  conversationType: varchar('conversation_type', { length: 50 }).default('GENERAL'),
  status: varchar('status', { length: 50 }).default('ACTIVE'),
  lastMessage: text('last_message'),
  lastMessageAt: timestamp('last_message_at'),
  assignedTo: integer('assigned_to').references(() => users.id),
  subject: varchar('subject', { length: 255 }),
  priority: varchar('priority', { length: 20 }).default('MEDIUM'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id),
  senderId: integer('sender_id').notNull().references(() => users.id),
  content: text('content').notNull(),
  messageType: varchar('message_type', { length: 50 }).default('TEXT'),
  attachedData: json('attached_data'),
  isRead: boolean('is_read').default(false),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Add missing tables for comprehensive functionality
export const supportTickets = pgTable('support_tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketNumber: varchar('ticket_number', { length: 100 }).notNull().unique(),
  userId: integer('user_id').references(() => users.id),
  userRole: varchar('user_role', { length: 50 }).default('GUEST'),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 255 }).notNull(),
  message: text('message').notNull(),
  status: varchar('status', { length: 50 }).default('OPEN'),
  priority: varchar('priority', { length: 20 }).default('NORMAL'),
  assignedTo: integer('assigned_to').references(() => users.id),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: integer('resolved_by').references(() => users.id),
  resolution: text('resolution'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const ratings = pgTable('ratings', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: integer('customer_id').notNull().references(() => users.id),
  merchantId: integer('merchant_id').references(() => users.id),
  productId: uuid('product_id').references(() => products.id),
  orderId: uuid('order_id').references(() => orders.id),
  rating: integer('rating').notNull(),
  comment: text('comment'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Additional missing tables for advanced features
export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  recipientId: integer('recipient_id').references(() => users.id),
  type: varchar('type', { length: 50 }).notNull(), // PAYMENT, REFUND, PAYOUT, DISPUTE, etc.
  amount: varchar('amount', { length: 20 }).notNull(),
  fee: varchar('fee', { length: 20 }).default('0.00'),
  netAmount: varchar('net_amount', { length: 20 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('NGN'),
  status: varchar('status', { length: 20 }).default('PENDING'),
  description: text('description'),
  paymentMethod: varchar('payment_method', { length: 50 }),
  transactionRef: varchar('transaction_ref', { length: 255 }),
  relatedOrderId: integer('related_order_id').references(() => orders.id),
  relatedTransactionId: integer('related_transaction_id'),
  processedBy: integer('processed_by').references(() => users.id),
  metadata: json('metadata'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Tables for advanced functionality mentioned in routes
export const vendorPosts = pgTable('vendor_posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: integer('vendor_id').notNull().references(() => users.id),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  postType: varchar('post_type', { length: 50 }).notNull(),
  productId: uuid('product_id').references(() => products.id),
  images: json('images'),
  tags: json('tags'),
  originalPrice: varchar('original_price', { length: 20 }),
  discountPrice: varchar('discount_price', { length: 20 }),
  discountPercentage: integer('discount_percentage'),
  validUntil: timestamp('valid_until'),
  viewCount: integer('view_count').default(0),
  likeCount: integer('like_count').default(0),
  commentCount: integer('comment_count').default(0),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const vendorPostLikes = pgTable('vendor_post_likes', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id').notNull().references(() => vendorPosts.id),
  userId: integer('user_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});

export const vendorPostComments = pgTable('vendor_post_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id').notNull().references(() => vendorPosts.id),
  userId: integer('user_id').notNull().references(() => users.id),
  content: text('content').notNull(),
  parentCommentId: uuid('parent_comment_id'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Identity and verification tables
export const identityVerifications = pgTable('identity_verifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: integer('user_id').notNull().references(() => users.id),
  faceImageUrl: varchar('face_image_url', { length: 500 }).notNull(),
  verificationStatus: varchar('verification_status', { length: 50 }).default('PENDING'),
  verifiedAt: timestamp('verified_at'),
  verifiedBy: integer('verified_by').references(() => users.id),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const driverVerifications = pgTable('driver_verifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: integer('user_id').notNull().references(() => users.id),
  licenseNumber: varchar('license_number', { length: 50 }).notNull(),
  licenseExpiryDate: timestamp('license_expiry_date').notNull(),
  licenseImageUrl: varchar('license_image_url', { length: 500 }),
  vehicleType: varchar('vehicle_type', { length: 50 }).notNull(),
  vehiclePlate: varchar('vehicle_plate', { length: 20 }).notNull(),
  vehicleModel: varchar('vehicle_model', { length: 100 }),
  vehicleYear: integer('vehicle_year'),
  verificationStatus: varchar('verification_status', { length: 50 }).default('PENDING'),
  verifiedAt: timestamp('verified_at'),
  verifiedBy: integer('verified_by').references(() => users.id),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const phoneVerifications = pgTable('phone_verifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: integer('user_id').notNull().references(() => users.id),
  phone: varchar('phone', { length: 20 }).notNull(),
  otp: varchar('otp', { length: 10 }).notNull(),
  isVerified: boolean('is_verified').default(false),
  expiresAt: timestamp('expires_at').notNull(),
  verifiedAt: timestamp('verified_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Additional advanced tables
export const mfaConfigurations = pgTable('mfa_configurations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: integer('user_id').notNull().references(() => users.id),
  isEnabled: boolean('is_enabled').default(false),
  secret: varchar('secret', { length: 255 }).notNull(),
  backupCodes: json('backup_codes'),
  lastUsedAt: timestamp('last_used_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Add tables for advanced security and fraud detection
export const fraudAlerts = pgTable('fraud_alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: integer('user_id').notNull().references(() => users.id),
  type: varchar('type', { length: 50 }).notNull(),
  severity: varchar('severity', { length: 20 }).notNull(),
  status: varchar('status', { length: 20 }).default('ACTIVE'),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  riskScore: integer('risk_score'),
  metadata: json('metadata'),
  detectedAt: timestamp('detected_at').defaultNow(),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: integer('resolved_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const suspiciousActivities = pgTable('suspicious_activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: integer('user_id').references(() => users.id),
  activityType: varchar('activity_type', { length: 50 }).notNull(),
  description: text('description').notNull(),
  riskIndicators: json('risk_indicators'),
  timestamp: timestamp('timestamp').defaultNow(),
  ipAddress: varchar('ip_address', { length: 45 }),
  deviceFingerprint: text('device_fingerprint'),
  severity: varchar('severity', { length: 20 }).default('MEDIUM'),
});

export const blacklistedEntities = pgTable('blacklisted_entities', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityValue: varchar('entity_value', { length: 255 }).notNull(),
  reason: text('reason').notNull(),
  blacklistedBy: integer('blacklisted_by').notNull().references(() => users.id),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const accountFlags = pgTable('account_flags', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: integer('user_id').notNull().references(() => users.id),
  flagType: varchar('flag_type', { length: 50 }).notNull(),
  severity: varchar('severity', { length: 20 }).notNull(),
  reason: text('reason').notNull(),
  flaggedBy: integer('flagged_by').notNull().references(() => users.id),
  status: varchar('status', { length: 20 }).default('ACTIVE'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Add missing tables for fuel, toll, QR codes, wallets
export const fuelInventory = pgTable('fuel_inventory', {
  id: uuid('id').primaryKey().defaultRandom(),
  merchantId: integer('merchant_id').notNull().references(() => users.id),
  fuelType: varchar('fuel_type', { length: 50 }).notNull(),
  quantity: varchar('quantity', { length: 20 }).notNull(),
  unit: varchar('unit', { length: 20 }).default('litres'),
  pricePerUnit: varchar('price_per_unit', { length: 20 }).notNull(),
  minimumOrderQuantity: varchar('minimum_order_quantity', { length: 20 }),
  maximumOrderQuantity: varchar('maximum_order_quantity', { length: 20 }),
  isAvailable: boolean('is_available').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const fuelOrders = pgTable('fuel_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: integer('customer_id').notNull().references(() => users.id),
  merchantId: integer('merchant_id').notNull().references(() => users.id),
  inventoryId: uuid('inventory_id').notNull().references(() => fuelInventory.id),
  orderType: varchar('order_type', { length: 50 }).notNull(),
  fuelType: varchar('fuel_type', { length: 50 }).notNull(),
  quantity: varchar('quantity', { length: 20 }).notNull(),
  unit: varchar('unit', { length: 20 }).notNull(),
  pricePerUnit: varchar('price_per_unit', { length: 20 }).notNull(),
  totalPrice: varchar('total_price', { length: 20 }).notNull(),
  deliveryAddress: text('delivery_address').notNull(),
  deliveryDate: timestamp('delivery_date'),
  specialInstructions: text('special_instructions'),
  orderNumber: varchar('order_number', { length: 100 }).notNull(),
  status: varchar('status', { length: 50 }).default('PENDING'),
  paymentStatus: varchar('payment_status', { length: 50 }).default('PENDING'),
  estimatedDeliveryTime: timestamp('estimated_delivery_time'),
  actualDeliveryTime: timestamp('actual_delivery_time'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const tollLocations = pgTable('toll_locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  location: varchar('location', { length: 255 }).notNull(),
  address: text('address').notNull(),
  latitude: decimal('latitude', { precision: 10, scale: 8 }),
  longitude: decimal('longitude', { precision: 11, scale: 8 }),
  operatingHours: json('operating_hours'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const tollPricing = pgTable('toll_pricing', {
  id: uuid('id').primaryKey().defaultRandom(),
  locationId: uuid('location_id').notNull().references(() => tollLocations.id),
  vehicleType: varchar('vehicle_type', { length: 50 }).notNull(),
  price: varchar('price', { length: 20 }).notNull(),
  currency: varchar('currency', { length: 10 }).default('NGN'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const tollPayments = pgTable('toll_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: integer('user_id').notNull().references(() => users.id),
  locationId: uuid('location_id').notNull().references(() => tollLocations.id),
  vehicleType: varchar('vehicle_type', { length: 50 }).notNull(),
  vehiclePlate: varchar('vehicle_plate', { length: 20 }).notNull(),
  amount: varchar('amount', { length: 20 }).notNull(),
  paymentMethod: varchar('payment_method', { length: 50 }).notNull(),
  transactionRef: varchar('transaction_ref', { length: 255 }),
  receiptNumber: varchar('receipt_number', { length: 100 }).notNull(),
  qrCodeUrl: varchar('qr_code_url', { length: 500 }),
  status: varchar('status', { length: 50 }).default('COMPLETED'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const qrCodes = pgTable('qr_codes', {
  id: varchar('id', { length: 50 }).primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  amount: varchar('amount', { length: 20 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 20 }).default('ACTIVE'),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  usedBy: integer('used_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});

export const wallets = pgTable('wallets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: integer('user_id').notNull().references(() => users.id),
  balance: varchar('balance', { length: 20 }).default('0.00'),
  currency: varchar('currency', { length: 10 }).default('NGN'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Security and logging tables
export const securityLogs = pgTable('security_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: integer('user_id').references(() => users.id),
  action: varchar('action', { length: 100 }).notNull(),
  details: text('details'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  severity: varchar('severity', { length: 20 }).default('INFO'),
  timestamp: timestamp('timestamp').defaultNow(),
});

export const trustedDevices = pgTable('trusted_devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: integer('user_id').notNull().references(() => users.id),
  deviceToken: varchar('device_token', { length: 255 }).notNull(),
  deviceName: varchar('device_name', { length: 100 }),
  deviceType: varchar('device_type', { length: 50 }),
  browserInfo: text('browser_info'),
  isActive: boolean('is_active').default(true),
  expiresAt: timestamp('expires_at').notNull(),
  lastUsedAt: timestamp('last_used_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Content moderation tables
export const contentReports = pgTable('content_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  reportedBy: integer('reported_by').notNull().references(() => users.id),
  contentType: varchar('content_type', { length: 50 }).notNull(),
  contentId: varchar('content_id', { length: 255 }).notNull(),
  reason: text('reason').notNull(),
  status: varchar('status', { length: 20 }).default('PENDING'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const moderationResponses = pgTable('moderation_responses', {
  id: uuid('id').primaryKey().defaultRandom(),
  reportId: uuid('report_id').notNull().references(() => contentReports.id),
  adminId: integer('admin_id').notNull().references(() => users.id),
  response: text('response').notNull(),
  action: varchar('action', { length: 50 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Define relations - simplified to avoid the error
export const usersRelations = relations(users, ({ many, one }) => ({
  merchantProfile: one(merchantProfiles, {
    fields: [users.id],
    references: [merchantProfiles.userId],
  }),
  driverProfile: one(driverProfiles, {
    fields: [users.id],
    references: [driverProfiles.userId],
  }),
  products: many(products),
  orders: many(orders),
  cartItems: many(cartItems),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  seller: one(users, {
    fields: [products.sellerId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  orders: many(orders),
  cartItems: many(cartItems),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  buyer: one(users, {
    fields: [orders.buyerId],
    references: [users.id],
  }),
  seller: one(users, {
    fields: [orders.sellerId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [orders.productId],
    references: [products.id],
  }),
}));

// Export all table schemas for validation
export const addCommoditySchema = createInsertSchema(products);
export const updateCommoditySchema = addCommoditySchema.partial();
export const addToCartSchema = createInsertSchema(cartItems);
export const updateCartItemSchema = addToCartSchema.partial();