import { pgTable, text, serial, integer, boolean, timestamp, decimal, uuid, json, jsonb, varchar, pgEnum, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

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
  latitude: decimal('latitude', { precision: 10, scale: 8 }), // For geo-location
  longitude: decimal('longitude', { precision: 11, scale: 8 }), // For geo-location
  address: text('address'), // For geo-location
  bio: text('bio'), // User biography/description
  socialAuth: jsonb('social_auth'), // { provider: 'google' | 'facebook' | 'apple', providerId: string }
  lastLoginAt: timestamp('last_login_at'), // For tracking login activity
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

export const userLocations = pgTable("user_locations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
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

// Business Categories table (for vendor business categorization)
export const businessCategories = pgTable('business_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  imageUrl: varchar('image_url', { length: 500 }),
  isDeleted: boolean('is_deleted').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

// Commodity Categories table (subcategories of business categories)
export const commodityCategories = pgTable('commodity_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  businessCategoryId: uuid('business_category_id').notNull().references(() => businessCategories.id),
  isDeleted: boolean('is_deleted').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

// Opening Hours table (for vendor operating hours)
export const openingHours = pgTable('opening_hours', {
  id: uuid('id').primaryKey().defaultRandom(),
  dayOfWeek: varchar('day_of_week', { length: 20 }), // Monday, Tuesday, etc.
  openTime: varchar('open_time', { length: 10 }), // e.g., "08:00"
  closeTime: varchar('close_time', { length: 10 }), // e.g., "20:00"
  vendorId: uuid('vendor_id').notNull().references(() => merchantProfiles.id),
  isDeleted: boolean('is_deleted').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  uniqueVendorDay: unique().on(table.vendorId, table.dayOfWeek),
}));


export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  price: varchar('price', { length: 20 }).notNull(),
  quantity: integer('quantity').notNull(),
  unit: varchar('unit', { length: 50 }),
  categoryId: integer('category_id').references(() => categories.id),
  vendorId: uuid('vendor_id').notNull().references(() => users.userId), // Changed to match Prisma
  sellerId: integer('seller_id').notNull().references(() => users.id), // Keep for backward compatibility
  imageUrl: varchar('image_url', { length: 500 }),
  image: varchar('image', { length: 500 }), // Keep for backward compatibility
  category: varchar('category', { length: 100 }), // Added from Prisma
  rating: decimal('rating', { precision: 3, scale: 2 }).default('0'),
  reviewCount: integer('review_count').default(0),
  inStock: boolean('in_stock').default(true),
  isActive: boolean('is_active').default(true),
  minimumOrder: integer('minimum_order').default(1),
  isDeleted: boolean('is_deleted').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  totalPrice: decimal('total_price', { precision: 10, scale: 2 }).notNull(),
  consumerId: uuid('consumer_id').notNull().references(() => users.userId),
  vendorId: uuid('vendor_id').notNull().references(() => users.userId),
  status: varchar('status', { length: 20 }).default('PENDING'), // FAILED, PENDING, PAID, COMPLETE
  txRef: varchar('tx_ref', { length: 255 }).unique(),
  transactionId: varchar('transaction_id', { length: 255 }),
  isDeleted: boolean('is_deleted').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

// Order Items table (stores cart items for orders)
export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  cartId: uuid('cart_id').notNull(),
  commodityId: uuid('commodity_id').notNull(),
  quantity: integer('quantity').notNull(),
  commodityName: varchar('commodity_name', { length: 255 }).notNull(),
  commodityDescription: text('commodity_description'),
  commodityPrice: varchar('commodity_price', { length: 20 }).notNull(),
  unit: varchar('unit', { length: 50 }),
  imageUrl: varchar('image_url', { length: 500 }),
  vendorId: uuid('vendor_id').notNull(),
  isDeleted: boolean('is_deleted').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

export const cartItems = pgTable('cart_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  cartId: uuid('cart_id').notNull().references(() => carts.id),
  commodityId: uuid('commodity_id').notNull().references(() => products.id),
  productId: integer('product_id').notNull().references(() => products.id), // Keep for backward compatibility
  vendorId: uuid('vendor_id'), // Added from Prisma
  quantity: integer('quantity').notNull(),
  isDeleted: boolean('is_deleted').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

export const vendorPosts = pgTable("vendor_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  vendorId: integer("vendor_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  postType: text("post_type", { enum: ["PRODUCT_UPDATE", "NEW_PRODUCT", "PROMOTION", "ANNOUNCEMENT", "RESTOCK"] }).notNull(),
  productId: uuid("product_id").references(() => products.id),
  images: text("images").array(),
  tags: text("tags").array(),
  originalPrice: decimal("original_price", { precision: 12, scale: 2 }),
  discountPrice: decimal("discount_price", { precision: 12, scale: 2 }),
  discountPercentage: integer("discount_percentage"),
  validUntil: timestamp("valid_until"),
  isActive: boolean("is_active").default(true),
  viewCount: integer("view_count").default(0),
  likeCount: integer("like_count").default(0),
  commentCount: integer("comment_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const vendorPostLikes = pgTable("vendor_post_likes", {
  id: serial("id").primaryKey(),
  postId: uuid("post_id").notNull().references(() => vendorPosts.id),
  userId: integer("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vendorPostComments = pgTable("vendor_post_comments", {
  id: serial("id").primaryKey(),
  postId: uuid("post_id").notNull().references(() => vendorPosts.id),
  userId: integer("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  parentCommentId: integer("parent_comment_id"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: integer("customer_id").notNull().references(() => users.id),
  vendorId: integer("vendor_id").notNull().references(() => users.id),
  productId: uuid("product_id").references(() => products.id),
  conversationType: text("conversation_type", { enum: ["QUOTE", "ORDER", "GENERAL"] }).notNull(),
  status: text("status", { enum: ["ACTIVE", "CLOSED"] }).default("ACTIVE"),
  lastMessage: text("last_message"),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id),
  senderId: integer("sender_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  messageType: text("message_type", { enum: ["TEXT", "QUOTE_REQUEST", "QUOTE_RESPONSE", "ORDER_UPDATE"] }).default("TEXT"),
  attachedData: json("attached_data"),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Merchant profiles table (enhanced to match Prisma Vendor model)
export const merchantProfiles = pgTable('merchant_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: integer('user_id').notNull().references(() => users.id),
  businessName: varchar('business_name', { length: 255 }).notNull(),
  businessType: varchar('business_type', { length: 100 }),
  businessDescription: text('business_description'),
  businessAddress: text('business_address').notNull(),
  businessPhone: varchar('business_phone', { length: 20 }),
  businessEmail: varchar('business_email', { length: 255 }),
  businessLogo: varchar('business_logo', { length: 500 }),
  businessHours: text('business_hours'),
  // Bank details for payments
  accountName: varchar('account_name', { length: 255 }),
  bankName: varchar('bank_name', { length: 255 }),
  accountNumber: varchar('account_number', { length: 50 }),
  bankCode: varchar('bank_code', { length: 20 }),
  // Business registration details
  businessCategory: varchar('business_category', { length: 100 }),
  businessNumber: varchar('business_number', { length: 100 }),
  isVerified: boolean('is_verified').default(false),
  subscriptionTier: varchar('subscription_tier', { length: 50 }).default('BASIC'),
  rating: decimal('rating', { precision: 3, scale: 2 }).default('0'),
  reviewCount: integer('review_count').default(0),
  totalSales: decimal('total_sales', { precision: 12, scale: 2 }).default('0'),
  totalOrders: integer('total_orders').default(0),
  isDeleted: boolean('is_deleted').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

export const merchantAnalytics = pgTable("merchant_analytics", {
  id: serial("id").primaryKey(),
  merchantId: integer("merchant_id").notNull().references(() => users.id),
  date: timestamp("date").defaultNow(),
  dailySales: decimal("daily_sales", { precision: 12, scale: 2 }).default("0"),
  dailyOrders: integer("daily_orders").default(0),
  dailyViews: integer("daily_views").default(0),
  dailyClicks: integer("daily_clicks").default(0),
  topProduct: uuid("top_product").references(() => products.id),
  peakHour: integer("peak_hour"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Driver profiles table (enhanced to match Prisma Driver model)
export const driverProfiles = pgTable('driver_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: integer('user_id').notNull().references(() => users.id),
  plateNumber: varchar('plate_number', { length: 20 }).notNull(), // From Prisma Driver model
  driverTier: varchar('driver_tier', { length: 20 }).default('BASIC'),
  accessLevel: varchar('access_level', { length: 20 }).default('STANDARD'),
  maxCargoValue: decimal('max_cargo_value', { precision: 10, scale: 2 }).default('50000'),
  vehicleType: varchar('vehicle_type', { length: 50 }).notNull(),
  vehiclePlate: varchar('vehicle_plate', { length: 20 }).notNull(),
  vehicleModel: varchar('vehicle_model', { length: 100 }),
  vehicleYear: integer('vehicle_year'),
  driverLicense: varchar('driver_license', { length: 50 }).notNull(),
  vehicleDocuments: text('vehicle_documents'),
  serviceTypes: text('service_types'),
  specializations: text('specializations'),
  isActive: boolean('is_active').default(true),
  isAvailable: boolean('is_available').default(false),
  currentLatitude: decimal('current_latitude', { precision: 10, scale: 8 }),
  currentLongitude: decimal('current_longitude', { precision: 11, scale: 8 }),
  rating: decimal('rating', { precision: 3, scale: 2 }).default('0'),
  totalRatings: integer('total_ratings').default(0),
  totalDeliveries: integer('total_deliveries').default(0),
  totalEarnings: decimal('total_earnings', { precision: 10, scale: 2 }).default('0'),
  lastActiveAt: timestamp('last_active_at'),
  isDeleted: boolean('is_deleted').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

export const deliveryRequests = pgTable("delivery_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: integer("customer_id").notNull().references(() => users.id),
  merchantId: integer("merchant_id").references(() => users.id),
  driverId: integer("driver_id").references(() => users.id),
  orderId: uuid("order_id").references(() => orders.id),
  deliveryType: text("delivery_type", { enum: ["FUEL", "PACKAGE", "FOOD", "GROCERY", "JEWELRY", "ELECTRONICS", "DOCUMENTS", "PHARMACEUTICALS", "HIGH_VALUE", "OTHER"] }).notNull(),
  cargoValue: decimal("cargo_value", { precision: 12, scale: 2 }).default("0"),
  requiresPremiumDriver: boolean("requires_premium_driver").default(false),
  pickupAddress: text("pickup_address").notNull(),
  deliveryAddress: text("delivery_address").notNull(),
  pickupLocation: json("pickup_location"),
  deliveryLocation: json("delivery_location"),
  estimatedDistance: decimal("estimated_distance", { precision: 8, scale: 2 }),
  estimatedDuration: integer("estimated_duration"),
  deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 }).notNull(),
  status: text("status", { enum: ["PENDING", "ASSIGNED", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "CANCELLED"] }).default("PENDING"),
  scheduledPickupTime: timestamp("scheduled_pickup_time"),
  actualPickupTime: timestamp("actual_pickup_time"),
  estimatedDeliveryTime: timestamp("estimated_delivery_time"),
  actualDeliveryTime: timestamp("actual_delivery_time"),
  specialInstructions: text("special_instructions"),
  trackingNumber: text("tracking_number").unique(),
  proofOfDelivery: text("proof_of_delivery"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Merchant Notifications
export const merchantNotifications = pgTable("merchant_notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  merchantId: integer("merchant_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type", {
    enum: ["ORDER", "PAYMENT", "DELIVERY", "PROMOTION", "SYSTEM", "REVIEW"]
  }).notNull(),
  relatedId: uuid("related_id"),
  isRead: boolean("is_read").default(false),
  priority: text("priority", { enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] }).default("MEDIUM"),
  actionUrl: text("action_url"),
  createdAt: timestamp("created_at").defaultNow(),
  readAt: timestamp("read_at"),
});

// Consumer Notifications
export const consumerNotifications = pgTable("consumer_notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  consumerId: integer("consumer_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type", {
    enum: ["ORDER_STATUS", "DELIVERY_UPDATE", "PAYMENT", "PROMOTION", "SYSTEM", "REVIEW_REQUEST"]
  }).notNull(),
  relatedId: uuid("related_id"),
  isRead: boolean("is_read").default(false),
  priority: text("priority", { enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] }).default("MEDIUM"),
  actionUrl: text("action_url"),
  createdAt: timestamp("created_at").defaultNow(),
  readAt: timestamp("read_at"),
});

// Driver Notifications
export const driverNotifications = pgTable("driver_notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  driverId: integer("driver_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type", {
    enum: ["DELIVERY_REQUEST", "PAYOUT_CONFIRMATION", "STATUS_UPDATE", "SYSTEM", "RATING"]
  }).notNull(),
  relatedId: uuid("related_id"),
  isRead: boolean("is_read").default(false),
  priority: text("priority", { enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] }).default("MEDIUM"),
  actionUrl: text("action_url"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  readAt: timestamp("read_at"),
});

// Support Tickets
export const supportTickets = pgTable("support_tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketNumber: text("ticket_number").notNull().unique(),
  userId: integer("user_id").references(() => users.id),
  userRole: text("user_role", { enum: ["CONSUMER", "MERCHANT", "DRIVER", "GUEST"] }).notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status", { enum: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] }).default("OPEN"),
  priority: text("priority", { enum: ["LOW", "NORMAL", "HIGH", "URGENT"] }).default("NORMAL"),
  assignedTo: integer("assigned_to").references(() => users.id),
  adminNotes: text("admin_notes"),
  resolution: text("resolution"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

// Identity Verification tables
export const identityVerifications = pgTable("identity_verifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  verificationStatus: text("verification_status", { enum: ["PENDING", "APPROVED", "REJECTED"] }).default("PENDING"),
  faceImageUrl: text("face_image_url"),
  verificationDate: timestamp("verification_date"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const driverVerifications = pgTable("driver_verifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  licenseNumber: text("license_number").notNull(),
  licenseExpiryDate: text("license_expiry_date").notNull(),
  licenseImageUrl: text("license_image_url"),
  vehicleType: text("vehicle_type").notNull(),
  vehiclePlate: text("vehicle_plate").notNull(),
  vehicleModel: text("vehicle_model"),
  vehicleYear: text("vehicle_year"),
  verificationStatus: text("verification_status", { enum: ["PENDING", "APPROVED", "REJECTED"] }).default("PENDING"),
  verificationDate: timestamp("verification_date"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const phoneVerifications = pgTable("phone_verifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  phoneNumber: text("phone_number").notNull(),
  otpCode: text("otp_code").notNull(),
  isVerified: boolean("is_verified").default(false),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// MFA (Multi-Factor Authentication) table
export const mfaConfigurations = pgTable("mfa_configurations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  isEnabled: boolean("is_enabled").default(false),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes").array(),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Trust & Safety - Fraud Detection
export const fraudAlerts = pgTable("fraud_alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("user_id").references(() => users.id),
  alertType: text("alert_type", {
    enum: ["PAYMENT_MISMATCH", "SUSPICIOUS_ACTIVITY", "VELOCITY_CHECK", "IP_CHANGE", "DEVICE_CHANGE", "UNUSUAL_TRANSACTION"]
  }).notNull(),
  severity: text("severity", { enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] }).notNull(),
  description: text("description").notNull(),
  metadata: jsonb("metadata"), // Store additional context data
  isResolved: boolean("is_resolved").default(false),
  resolvedBy: integer("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  resolution: text("resolution"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  relatedTransactionId: text("related_transaction_id"),
  riskScore: decimal("risk_score", { precision: 3, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Trust & Safety - Reports System
export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  reporterId: integer("reporter_id").references(() => users.id),
  reportedUserId: integer("reported_user_id").references(() => users.id),
  reportedProductId: uuid("reported_product_id").references(() => products.id),
  reportType: text("report_type", {
    enum: ["USER_ABUSE", "PRODUCT_SCAM", "FAKE_LISTING", "INAPPROPRIATE_CONTENT", "FRAUD", "HARASSMENT", "SPAM", "OTHER"]
  }).notNull(),
  category: text("category", {
    enum: ["SAFETY", "FRAUD", "CONTENT", "BEHAVIOR", "POLICY_VIOLATION"]
  }).notNull(),
  reason: text("reason").notNull(),
  description: text("description").notNull(),
  evidence: text("evidence").array(), // URLs to screenshots, documents, etc.
  status: text("status", {
    enum: ["PENDING", "UNDER_REVIEW", "RESOLVED", "DISMISSED", "ESCALATED"]
  }).default("PENDING"),
  priority: text("priority", { enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] }).default("MEDIUM"),
  assignedTo: integer("assigned_to").references(() => users.id),
  adminNotes: text("admin_notes"),
  resolution: text("resolution"),
  actionTaken: text("action_taken", {
    enum: ["NO_ACTION", "WARNING_SENT", "CONTENT_REMOVED", "USER_SUSPENDED", "USER_BANNED", "PRODUCT_REMOVED", "MERCHANT_RESTRICTED"]
  }),
  reporterAnonymous: boolean("reporter_anonymous").default(false),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

// User Activity Tracking for Fraud Detection
export const userActivities = pgTable("user_activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("user_id").references(() => users.id).notNull(),
  activityType: text("activity_type", {
    enum: ["LOGIN", "PAYMENT", "ORDER_PLACE", "PROFILE_UPDATE", "PASSWORD_CHANGE", "WITHDRAWAL", "REFUND"]
  }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  deviceFingerprint: text("device_fingerprint"),
  location: jsonb("location"), // { country, city, lat, lng }
  sessionId: text("session_id"),
  riskScore: decimal("risk_score", { precision: 3, scale: 2 }).default("0"),
  flagged: boolean("flagged").default(false),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Blacklisted Entities
export const blacklistedEntities = pgTable("blacklisted_entities", {
  id: serial("id").primaryKey(),
  entityType: text("entity_type", { enum: ["EMAIL", "PHONE", "IP", "DEVICE", "BANK_ACCOUNT"] }).notNull(),
  entityValue: text("entity_value").notNull(),
  reason: text("reason").notNull(),
  addedBy: integer("added_by").references(() => users.id).notNull(),
  isActive: boolean("is_active").default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Fuel Inventory Schema
export const fuelInventory = pgTable('fuel_inventory', {
  id: serial('id').primaryKey(),
  merchantId: integer('merchant_id').notNull().references(() => users.id),
  fuelType: text('fuel_type', {
    enum: ['PETROL', 'DIESEL', 'KEROSENE', 'COOKING_GAS', 'INDUSTRIAL_GAS']
  }).notNull(),
  quantity: decimal('quantity', { precision: 12, scale: 2 }).notNull(),
  unit: text('unit', { enum: ['LITERS', 'GALLONS', 'KG', 'TONS'] }).notNull(),
  pricePerUnit: decimal('price_per_unit', { precision: 10, scale: 2 }).notNull(),
  minimumOrderQuantity: decimal('minimum_order_quantity', { precision: 10, scale: 2 }).default('1'),
  maximumOrderQuantity: decimal('maximum_order_quantity', { precision: 12, scale: 2 }),
  isAvailable: boolean('is_available').default(true),
  location: text('location'),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Fuel Orders Schema
export const fuelOrders = pgTable('fuel_orders', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id').notNull().references(() => users.id),
  merchantId: integer('merchant_id').notNull().references(() => users.id),
  driverId: integer('driver_id').references(() => users.id),
  inventoryId: integer('inventory_id').notNull().references(() => fuelInventory.id),
  orderType: text('order_type', { enum: ['BULK', 'SMALL_SCALE'] }).notNull(),
  fuelType: text('fuel_type', {
    enum: ['PETROL', 'DIESEL', 'KEROSENE', 'COOKING_GAS', 'INDUSTRIAL_GAS']
  }).notNull(),
  quantity: decimal('quantity', { precision: 12, scale: 2 }).notNull(),
  unit: text('unit', { enum: ['LITERS', 'GALLONS', 'KG', 'TONS'] }).notNull(),
  pricePerUnit: decimal('price_per_unit', { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal('total_price', { precision: 12, scale: 2 }).notNull(),
  deliveryAddress: text('delivery_address').notNull(),
  deliveryDate: timestamp('delivery_date'),
  status: text('status', {
    enum: ['PENDING', 'CONFIRMED', 'PROCESSING', 'DISPATCHED', 'DELIVERED', 'CANCELLED']
  }).default('PENDING'),
  paymentStatus: text('payment_status', {
    enum: ['PENDING', 'PAID', 'REFUNDED']
  }).default('PENDING'),
  specialInstructions: text('special_instructions'),
  orderNumber: text('order_number').unique(),
  estimatedDeliveryTime: timestamp('estimated_delivery_time'),
  actualDeliveryTime: timestamp('actual_delivery_time'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Toll Gate Locations Schema
export const tollLocations = pgTable('toll_locations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  location: text('location').notNull(),
  address: text('address').notNull(),
  latitude: decimal('latitude', { precision: 10, scale: 8 }).notNull(),
  longitude: decimal('longitude', { precision: 11, scale: 8 }).notNull(),
  operatorId: integer('operator_id').references(() => users.id),
  operatingHours: jsonb('operating_hours'), // { start: '06:00', end: '22:00' }
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Toll Pricing Schema
export const tollPricing = pgTable('toll_pricing', {
  id: serial('id').primaryKey(),
  locationId: integer('location_id').notNull().references(() => tollLocations.id),
  vehicleType: text('vehicle_type', {
    enum: ['MOTORCYCLE', 'CAR', 'BUS', 'TRUCK', 'TRAILER']
  }).notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').default('NGN'),
  isActive: boolean('is_active').default(true),
  validFrom: timestamp('valid_from').defaultNow(),
  validTo: timestamp('valid_to'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Toll Payments Schema
export const tollPayments = pgTable('toll_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: integer('user_id').notNull().references(() => users.id),
  locationId: integer('location_id').notNull().references(() => tollLocations.id),
  vehicleType: text('vehicle_type', {
    enum: ['MOTORCYCLE', 'CAR', 'BUS', 'TRUCK', 'TRAILER']
  }).notNull(),
  vehiclePlate: text('vehicle_plate').notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').default('NGN'),
  paymentMethod: text('payment_method', {
    enum: ['CARD', 'BANK_TRANSFER', 'WALLET', 'CASH']
  }).notNull(),
  paymentReference: text('payment_reference').notNull().unique(),
  transactionId: text('transaction_id'),
  status: text('status', {
    enum: ['PENDING', 'SUCCESSFUL', 'FAILED', 'CANCELLED']
  }).default('PENDING'),
  receiptNumber: text('receipt_number').unique(),
  qrCodeData: text('qr_code_data'),
  qrCodeImageUrl: text('qr_code_image_url'),
  paymentDate: timestamp('payment_date').defaultNow(),
  verifiedAt: timestamp('verified_at'),
  verifiedBy: integer('verified_by').references(() => users.id),
  metadata: jsonb('metadata'), // Additional payment data
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  products: many(products),
  orders: many(orders),
  cartItems: many(cartItems),
  vendorPosts: many(vendorPosts),
  vendorPostLikes: many(vendorPostLikes),
  vendorPostComments: many(vendorPostComments),
  merchantProfile: one(merchantProfiles),
  driverProfile: one(driverProfiles),
  userLocations: many(userLocations),
  sentMessages: many(chatMessages),
  customerConversations: many(conversations, { relationName: "customerConversations" }),
  vendorConversations: many(conversations, { relationName: "vendorConversations" }),
  deliveryRequests: many(deliveryRequests),
  merchantNotifications: many(merchantNotifications),
  consumerNotifications: many(consumerNotifications),
  driverNotifications: many(driverNotifications),
  supportTickets: many(supportTickets),
  identityVerifications: many(identityVerifications),
  driverVerifications: many(driverVerifications),
  phoneVerifications: many(phoneVerifications),
  mfaConfiguration: one(mfaConfigurations),
  tollPayments: many(tollPayments),
  operatedTollLocations: many(tollLocations),
}));

export const merchantNotificationsRelations = relations(merchantNotifications, ({ one }) => ({
  merchant: one(users, { fields: [merchantNotifications.merchantId], references: [users.id] }),
}));

export const consumerNotificationsRelations = relations(consumerNotifications, ({ one }) => ({
  consumer: one(users, { fields: [consumerNotifications.consumerId], references: [users.id] }),
}));

export const driverNotificationsRelations = relations(driverNotifications, ({ one }) => ({
  driver: one(users, { fields: [driverNotifications.driverId], references: [users.id] }),
}));

export const supportTicketsRelations = relations(supportTickets, ({ one }) => ({
  user: one(users, { fields: [supportTickets.userId], references: [users.id] }),
  assignedTo: one(users, { fields: [supportTickets.assignedTo], references: [users.id] }),
}));

export const identityVerificationsRelations = relations(identityVerifications, ({ one }) => ({
  user: one(users, { fields: [identityVerifications.userId], references: [users.id] }),
}));

export const driverVerificationsRelations = relations(driverVerifications, ({ one }) => ({
  user: one(users, { fields: [driverVerifications.userId], references: [users.id] }),
}));

export const phoneVerificationsRelations = relations(phoneVerifications, ({ one }) => ({
  user: one(users, { fields: [phoneVerifications.userId], references: [users.id] }),
}));

export const mfaConfigurationsRelations = relations(mfaConfigurations, ({ one }) => ({
  user: one(users, { fields: [mfaConfigurations.userId], references: [users.id] }),
}));

export const fraudAlertsRelations = relations(fraudAlerts, ({ one }) => ({
  user: one(users, { fields: [fraudAlerts.userId], references: [users.id] }),
  resolvedBy: one(users, { fields: [fraudAlerts.resolvedBy], references: [users.id] }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  reporter: one(users, { fields: [reports.reporterId], references: [users.id] }),
  reportedUser: one(users, { fields: [reports.reportedUserId], references: [users.id] }),
  reportedProduct: one(products, { fields: [reports.reportedProductId], references: [products.id] }),
  assignedTo: one(users, { fields: [reports.assignedTo], references: [users.id] }),
}));

export const userActivitiesRelations = relations(userActivities, ({ one }) => ({
  user: one(users, { fields: [userActivities.userId], references: [users.id] }),
}));

export const blacklistedEntitiesRelations = relations(blacklistedEntities, ({ one }) => ({
  addedBy: one(users, { fields: [blacklistedEntities.addedBy], references: [users.id] }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  seller: one(users, { fields: [products.sellerId], references: [users.id] }),
  orders: many(orders),
  cartItems: many(cartItems),
  vendorPosts: many(vendorPosts),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  buyer: one(users, { fields: [orders.buyerId], references: [users.id] }),
  seller: one(users, { fields: [orders.sellerId], references: [users.id] }),
  product: one(products, { fields: [orders.productId], references: [products.id] }),
  driver: one(users, { fields: [orders.driverId], references: [users.id] }),
}));

export const vendorPostsRelations = relations(vendorPosts, ({ one, many }) => ({
  vendor: one(users, { fields: [vendorPosts.vendorId], references: [users.id] }),
  product: one(products, { fields: [vendorPosts.productId], references: [products.id] }),
  likes: many(vendorPostLikes),
  comments: many(vendorPostComments),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  customer: one(users, { fields: [conversations.customerId], references: [users.id], relationName: "customerConversations" }),
  vendor: one(users, { fields: [conversations.vendorId], references: [users.id], relationName: "vendorConversations" }),
  product: one(products, { fields: [conversations.productId], references: [products.id] }),
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  conversation: one(conversations, { fields: [chatMessages.conversationId], references: [conversations.id] }),
  sender: one(users, { fields: [chatMessages.senderId], references: [users.id] }),
}));

// Fuel Inventory Relations
export const fuelInventoryRelations = relations(fuelInventory, ({ one, many }) => ({
  merchant: one(users, { fields: [fuelInventory.merchantId], references: [users.id] }),
  fuelOrders: many(fuelOrders),
}));

// Fuel Orders Relations
export const fuelOrdersRelations = relations(fuelOrders, ({ one }) => ({
  customer: one(users, { fields: [fuelOrders.customerId], references: [users.id] }),
  merchant: one(users, { fields: [fuelOrders.merchantId], references: [users.id] }),
  driver: one(users, { fields: [fuelOrders.driverId], references: [users.id] }),
  inventory: one(fuelInventory, { fields: [fuelOrders.inventoryId], references: [fuelInventory.id] }),
}));

// Toll Location Relations
export const tollLocationsRelations = relations(tollLocations, ({ one, many }) => ({
  operator: one(users, { fields: [tollLocations.operatorId], references: [users.id] }),
  pricing: many(tollPricing),
  payments: many(tollPayments),
}));

// Toll Pricing Relations
export const tollPricingRelations = relations(tollPricing, ({ one }) => ({
  location: one(tollLocations, { fields: [tollPricing.locationId], references: [tollLocations.id] }),
}));

// Toll Payment Relations
export const tollPaymentsRelations = relations(tollPayments, ({ one }) => ({
  user: one(users, { fields: [tollPayments.userId], references: [users.id] }),
  location: one(tollLocations, { fields: [tollPayments.locationId], references: [tollLocations.id] }),
  verifiedBy: one(users, { fields: [tollPayments.verifiedBy], references: [users.id] }),
}));

// Receipts table
export const receipts = pgTable("receipts", {
  id: serial("id").primaryKey(),
  receiptNumber: text("receipt_number").notNull().unique(),
  orderId: uuid("order_id").notNull().references(() => orders.id),
  customerId: integer("customer_id").notNull().references(() => users.id),
  merchantId: integer("merchant_id").notNull().references(() => users.id),
  driverId: integer("driver_id").references(() => users.id),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull(),
  paymentStatus: text("payment_status", {
    enum: ["PENDING", "COMPLETED", "FAILED", "REFUNDED"]
  }).notNull().default("PENDING"),
  transactionRef: text("transaction_ref"),
  qrCodeData: text("qr_code_data").notNull(),
  qrCodeImageUrl: text("qr_code_image_url"),
  receiptPdfUrl: text("receipt_pdf_url"),
  deliveryStatus: text("delivery_status", {
    enum: ["PENDING", "IN_TRANSIT", "DELIVERED", "FAILED"]
  }).default("PENDING"),
  deliveryVerifiedAt: timestamp("delivery_verified_at"),
  deliveryVerifiedBy: integer("delivery_verified_by").references(() => users.id),
  merchantVerifiedAt: timestamp("merchant_verified_at"),
  merchantVerifiedBy: integer("merchant_verified_by").references(() => users.id),
  adminVerifiedAt: timestamp("admin_verified_at"),
  adminVerifiedBy: integer("admin_verified_by").references(() => users.id),
  isActive: boolean("is_active").default(true),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Wallets table
export const wallets = pgTable("wallets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  balance: decimal("balance", { precision: 15, scale: 2 }).default('0.00'),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Transactions table
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  orderId: uuid("order_id").references(() => orders.id),
  recipientId: integer("recipient_id").references(() => users.id),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  netAmount: decimal("net_amount", { precision: 15, scale: 2 }),
  currency: text("currency").default('NGN'),
  type: text("type", { enum: ['Wallet_FUNDING', 'PAYMENT', 'WITHDRAWAL', 'TRANSFER_IN', 'TRANSFER_OUT', 'DELIVERY_EARNINGS', 'REFUND'] }).notNull(),
  status: text("status").default('PENDING'),
  paymentMethod: text("payment_method"),
  paymentStatus: text("payment_status", { enum: ["PENDING", "COMPLETED", "FAILED", "REFUNDED"] }).default('PENDING'),
  transactionRef: text("transaction_ref").unique(),
  paymentGatewayRef: text("payment_gateway_ref"),
  paystackTransactionId: text("paystack_transaction_id"),
  description: text("description"),
  metadata: jsonb("metadata"),
  initiatedAt: timestamp("initiated_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow()
});

// Ratings table
export const ratings = pgTable("ratings", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => users.id),
  orderId: uuid("order_id").references(() => orders.id),
  driverId: integer("driver_id").references(() => users.id),
  merchantId: integer("merchant_id").references(() => users.id),
  productId: uuid("product_id").references(() => products.id),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Delivery Feedback table
export const deliveryFeedback = pgTable("delivery_feedback", {
  id: serial("id").primaryKey(),
  orderId: uuid("order_id").references(() => orders.id).notNull(),
  customerId: integer("customer_id").references(() => users.id).notNull(),
  driverId: integer("driver_id").references(() => users.id).notNull(),
  feedbackType: varchar("feedback_type", { length: 50 }).notNull(), // CUSTOMER_TO_DRIVER, DRIVER_TO_CUSTOMER

  // Customer ratings
  driverRating: integer("driver_rating"),
  serviceRating: integer("service_rating"),
  deliveryTimeRating: integer("delivery_time_rating"),
  deliveryQuality: varchar("delivery_quality", { length: 20 }), // EXCELLENT, GOOD, AVERAGE, POOR
  wouldRecommend: boolean("would_recommend"),
  issuesReported: text("issues_reported"),

  // Driver feedback
  customerRating: integer("customer_rating"),
  deliveryComplexity: varchar("delivery_complexity", { length: 20 }), // EASY, MODERATE, DIFFICULT
  customerCooperation: varchar("customer_cooperation", { length: 20 }), // EXCELLENT, GOOD, AVERAGE, POOR
  paymentIssues: boolean("payment_issues"),

  // Common fields
  comment: text("comment"),
  additionalFeedback: text("additional_feedback"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Notifications table
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(),
  isRead: boolean("is_read").default(false),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow()
});

// Error Logs table
export const errorLogs = pgTable("error_logs", {
  id: serial("id").primaryKey(),
  message: text("message").notNull(),
  stack: text("stack"),
  url: text("url"),
  userAgent: text("user_agent"),
  userId: integer("user_id").references(() => users.id),
  severity: text("severity").default("MEDIUM"),
  source: text("source").default("backend"),
  timestamp: timestamp("timestamp").defaultNow(),
  metadata: jsonb("metadata")
});

// MFA Tokens table
export const mfaTokens = pgTable("mfa_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  token: text("token").notNull(),
  method: text("method").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  isUsed: boolean("is_used").default(false),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow()
});

// Verification Documents table
export const verificationDocuments = pgTable("verification_documents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  documentType: text("document_type").notNull(),
  documentNumber: text("document_number"),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  expiryDate: timestamp("expiry_date"),
  status: text("status").default('PENDING'),
  validationScore: decimal("validation_score", { precision: 3, scale: 2 }),
  extractedData: jsonb("extracted_data"),
  rejectionReason: text("rejection_reason"),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Security Logs table
export const securityLogs = pgTable("security_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(),
  details: jsonb("details"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  severity: text("severity").default('INFO'),
  timestamp: timestamp("timestamp").defaultNow()
});

// Trusted Devices table
export const trustedDevices = pgTable("trusted_devices", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  deviceToken: text("device_token").unique().notNull(),
  deviceName: text("device_name"),
  deviceType: text("device_type"),
  browserInfo: text("browser_info"),
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow()
});

// Suspicious Activities table
export const suspiciousActivities = pgTable("suspicious_activities", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  activityType: text("activity_type").notNull(),
  description: text("description").notNull(),
  riskIndicators: jsonb("risk_indicators"),
  timestamp: timestamp("timestamp").defaultNow(),
  ipAddress: text("ip_address"),
  deviceFingerprint: text("device_fingerprint"),
  severity: text("severity").default('MEDIUM')
});

// Admin Users table
export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  role: text("role").default('ADMIN'),
  permissions: jsonb("permissions").default('[]'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Compliance Documents table
export const complianceDocuments = pgTable("compliance_documents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  documentType: text("document_type").notNull(),
  documentUrl: text("document_url").notNull(),
  status: text("status").default('PENDING'),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Content Reports table
export const contentReports = pgTable("content_reports", {
  id: serial("id").primaryKey(),
  contentType: text("content_type").notNull(),
  contentId: text("content_id").notNull(),
  reportedBy: integer("reported_by").references(() => users.id),
  reason: text("reason").notNull(),
  status: text("status").default('PENDING'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Moderation Responses table
export const moderationResponses = pgTable("moderation_responses", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id").references(() => contentReports.id).notNull(),
  adminId: integer("admin_id").references(() => adminUsers.id).notNull(),
  response: text("response").notNull(),
  action: text("action").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});

// Payment Methods table
export const paymentMethods = pgTable("payment_methods", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(),
  details: jsonb("details").notNull(),
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow()
});

// Admin Payment Actions table
export const adminPaymentActions = pgTable("admin_payment_actions", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").references(() => adminUsers.id).notNull(),
  action: text("action").notNull(),
  paymentId: text("payment_id").notNull(),
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow()
});

// Account Flags table
export const accountFlags = pgTable("account_flags", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  flagType: text("flag_type").notNull(),
  severity: text("severity").default('MEDIUM'),
  reason: text("reason").notNull(),
  flaggedBy: integer("flagged_by").references(() => adminUsers.id),
  status: text("status").default('ACTIVE'),
  resolvedBy: integer("resolved_by").references(() => adminUsers.id),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow()
});

// Audit Logs table
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  resourceId: text("resource_id"),
  oldValues: text("old_values"),
  newValues: text("new_values"),
  ipAddress: text("ip_address").notNull(),
  userAgent: text("user_agent").notNull(),
  sessionId: text("session_id"),
  success: boolean("success").notNull(),
  errorMessage: text("error_message"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow()
});

// Order Tracking table
export const orderTracking = pgTable("order_tracking", {
  id: serial("id").primaryKey(),
  orderId: uuid("order_id").references(() => orders.id).notNull(),
  driverId: integer("driver_id").references(() => users.id),
  status: text("status").notNull(),
  location: text("location"),
  notes: text("notes"),
  estimatedArrival: timestamp("estimated_arrival"),
  timestamp: timestamp("timestamp").defaultNow()
});

// Receipt relations
export const receiptsRelations = relations(receipts, ({ one }) => ({
  order: one(orders, {
    fields: [receipts.orderId],
    references: [orders.id],
  }),
  customer: one(users, {
    fields: [receipts.customerId],
    references: [users.id],
  }),
  merchant: one(users, {
    fields: [receipts.merchantId],
    references: [users.id],
  }),
  driver: one(users, {
    fields: [receipts.driverId],
    references: [users.id],
  }),
}));

// Validation schemas
export const insertUserSchema = createInsertSchema(users);
export const insertProductSchema = createInsertSchema(products);
export const insertOrderSchema = createInsertSchema(orders);
export const insertCartItemSchema = createInsertSchema(cartItems);
export const insertVendorPostSchema = createInsertSchema(vendorPosts);
export const insertConversationSchema = createInsertSchema(conversations);
export const insertChatMessageSchema = createInsertSchema(chatMessages);
export const insertMerchantProfileSchema = createInsertSchema(merchantProfiles);
export const insertDriverProfileSchema = createInsertSchema(driverProfiles);
export const insertDeliveryRequestSchema = createInsertSchema(deliveryRequests);
export const insertMerchantNotificationSchema = createInsertSchema(merchantNotifications);
export const insertConsumerNotificationSchema = createInsertSchema(consumerNotifications);
export const insertDriverNotificationSchema = createInsertSchema(driverNotifications);
export const insertSupportTicketSchema = createInsertSchema(supportTickets);
export const insertIdentityVerificationSchema = createInsertSchema(identityVerifications);
export const insertDriverVerificationSchema = createInsertSchema(driverVerifications);
export const insertPhoneVerificationSchema = createInsertSchema(phoneVerifications);
export const insertMfaConfigurationSchema = createInsertSchema(mfaConfigurations);
export const insertReceiptSchema = createInsertSchema(receipts);
export const insertFraudAlertSchema = createInsertSchema(fraudAlerts);
export const insertReportSchema = createInsertSchema(reports);
export const insertUserActivitySchema = createInsertSchema(userActivities);
export const insertBlacklistedEntitySchema = createInsertSchema(blacklistedEntities);
export const insertFuelInventorySchema = createInsertSchema(fuelInventory);
export const insertFuelOrderSchema = createInsertSchema(fuelOrders);
export const insertTollLocationSchema = createInsertSchema(tollLocations);
export const insertTollPricingSchema = createInsertSchema(tollPricing);
export const insertTollPaymentSchema = createInsertSchema(tollPayments);
export const insertWalletSchema = createInsertSchema(wallets);
export const insertTransactionSchema = createInsertSchema(transactions);
export const insertRatingSchema = createInsertSchema(ratings);
export const insertDeliveryFeedbackSchema = createInsertSchema(deliveryFeedback);
export const insertNotificationSchema = createInsertSchema(notifications);
export const insertErrorLogSchema = createInsertSchema(errorLogs);
export const insertMfaTokenSchema = createInsertSchema(mfaTokens);
export const insertVerificationDocumentSchema = createInsertSchema(verificationDocuments);
export const insertSecurityLogSchema = createInsertSchema(securityLogs);
export const insertTrustedDeviceSchema = createInsertSchema(trustedDevices);
export const insertSuspiciousActivitySchema = createInsertSchema(suspiciousActivities);
export const insertAdminUserSchema = createInsertSchema(adminUsers);
export const insertComplianceDocumentSchema = createInsertSchema(complianceDocuments);
export const insertContentReportSchema = createInsertSchema(contentReports);
export const insertModerationResponseSchema = createInsertSchema(moderationResponses);
export const insertPaymentMethodSchema = createInsertSchema(paymentMethods);
export const insertAdminPaymentActionSchema = createInsertSchema(adminPaymentActions);
export const insertAccountFlagSchema = createInsertSchema(accountFlags);
export const insertAuditLogSchema = createInsertSchema(auditLogs);
export const insertOrderTrackingSchema = createInsertSchema(orderTracking);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type FuelInventory = typeof fuelInventory.$inferSelect;
export type NewFuelInventory = typeof fuelInventory.$inferInsert;
export type FuelOrder = typeof fuelOrders.$inferSelect;
export type NewFuelOrder = typeof fuelOrders.$inferInsert;
export type TollLocation = typeof tollLocations.$inferSelect;
export type NewTollLocation = typeof tollLocations.$inferInsert;
export type TollPricing = typeof tollPricing.$inferSelect;
export type NewTollPricing = typeof tollPricing.$inferInsert;
export type TollPayment = typeof tollPayments.$inferSelect;
export type NewTollPayment = typeof tollPayments.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type CartItem = typeof cartItems.$inferSelect;
export type NewCartItem = typeof cartItems.$inferInsert;
export type VendorPost = typeof vendorPosts.$inferSelect;
export type NewVendorPost = typeof vendorPosts.$insert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$insert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$insert;
export type MerchantProfile = typeof merchantProfiles.$inferSelect;
export type NewMerchantProfile = typeof merchantProfiles.$insert;
export type DriverProfile = typeof driverProfiles.$inferSelect;
export type NewDriverProfile = typeof driverProfiles.$insert;
export type DeliveryRequest = typeof deliveryRequests.$inferSelect;
export type NewDeliveryRequest = typeof deliveryRequests.$insert;
export type MerchantNotification = typeof merchantNotifications.$inferSelect;
export type NewMerchantNotification = typeof merchantNotifications.$insert;
export type ConsumerNotification = typeof consumerNotifications.$inferSelect;
export type NewConsumerNotification = typeof consumerNotifications.$insert;
export type DriverNotification = typeof driverNotifications.$inferSelect;
export type NewDriverNotification = typeof driverNotifications.$insert;
export type SupportTicket = typeof supportTickets.$inferSelect;
export type NewSupportTicket = typeof supportTickets.$insert;
export type IdentityVerification = typeof identityVerifications.$inferSelect;
export type NewIdentityVerification = typeof identityVerifications.$insert;
export type DriverVerification = typeof driverVerifications.$inferSelect;
export type NewDriverVerification = typeof driverVerifications.$insert;
export type PhoneVerification = typeof phoneVerifications.$inferSelect;
export type NewPhoneVerification = typeof phoneVerifications.$insert;
export type MfaConfiguration = typeof mfaConfigurations.$inferSelect;
export type NewMfaConfiguration = typeof mfaConfigurations.$insert;
export type Receipt = typeof receipts.$inferSelect;
export type NewReceipt = typeof receipts.$insert;
export type FraudAlert = typeof fraudAlerts.$inferSelect;
export type NewFraudAlert = typeof fraudAlerts.$insert;
export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$insert;
export type UserActivity = typeof userActivities.$inferSelect;
export type NewUserActivity = typeof userActivities.$insert;
export type BlacklistedEntity = typeof blacklistedEntities.$inferSelect;
export type NewBlacklistedEntity = typeof blacklistedEntities.$insert;
export type Wallet = typeof wallets.$inferSelect;
export type NewWallet = typeof wallets.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$insert;
export type Rating = typeof ratings.$inferSelect;
export type NewRating = typeof ratings.$insert;
export type DeliveryFeedback = typeof deliveryFeedback.$inferSelect;
export type NewDeliveryFeedback = typeof deliveryFeedback.$insert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$insert;
export type ErrorLog = typeof errorLogs.$inferSelect;
export type NewErrorLog = typeof errorLogs.$insert;
export type MfaToken = typeof mfaTokens.$inferSelect;
export type NewMfaToken = typeof mfaTokens.$insert;
export type VerificationDocument = typeof verificationDocuments.$inferSelect;
export type NewVerificationDocument = typeof verificationDocuments.$insert;
export type SecurityLog = typeof securityLogs.$inferSelect;
export type NewSecurityLog = typeof securityLogs.$insert;
export type TrustedDevice = typeof trustedDevices.$inferSelect;
export type NewTrustedDevice = typeof trustedDevices.$insert;
export type SuspiciousActivity = typeof suspiciousActivities.$inferSelect;
export type NewSuspiciousActivity = typeof suspiciousActivities.$insert;
export type AdminUser = typeof adminUsers.$inferSelect;
export type NewAdminUser = typeof adminUsers.$insert;
export type ComplianceDocument = typeof complianceDocuments.$inferSelect;
export type NewComplianceDocument = typeof complianceDocuments.$insert;
export type ContentReport = typeof contentReports.$inferSelect;
export type NewContentReport = typeof contentReports.$insert;
export type ModerationResponse = typeof moderationResponses.$inferSelect;
export type NewModerationResponse = typeof moderationResponses.$insert;
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type NewPaymentMethod = typeof paymentMethods.$insert;
export type AdminPaymentAction = typeof adminPaymentActions.$inferSelect;
export type NewAdminPaymentAction = typeof adminPaymentActions.$insert;
export type AccountFlag = typeof accountFlags.$inferSelect;
export type NewAccountFlag = typeof accountFlags.$insert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$insert;
export type OrderTracking = typeof orderTracking.$inferSelect;
export type NewOrderTracking = typeof orderTracking.$insert;