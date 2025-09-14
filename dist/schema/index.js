"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.conversationsRelations = exports.vendorPostsRelations = exports.ordersRelations = exports.productsRelations = exports.blacklistedEntitiesRelations = exports.userActivitiesRelations = exports.reportsRelations = exports.fraudAlertsRelations = exports.mfaConfigurationsRelations = exports.phoneVerificationsRelations = exports.driverVerificationsRelations = exports.identityVerificationsRelations = exports.supportTicketsRelations = exports.driverNotificationsRelations = exports.consumerNotificationsRelations = exports.merchantNotificationsRelations = exports.usersRelations = exports.tollPayments = exports.tollPricing = exports.tollLocations = exports.fuelOrders = exports.fuelInventory = exports.blacklistedEntities = exports.userActivities = exports.reports = exports.fraudAlerts = exports.mfaConfigurations = exports.phoneVerifications = exports.driverVerifications = exports.identityVerifications = exports.supportTickets = exports.driverNotifications = exports.consumerNotifications = exports.merchantNotifications = exports.deliveryRequests = exports.driverProfiles = exports.merchantAnalytics = exports.merchantProfiles = exports.chatMessages = exports.conversations = exports.vendorPostComments = exports.vendorPostLikes = exports.vendorPosts = exports.cartItems = exports.orders = exports.products = exports.categories = exports.userLocations = exports.otpCodes = exports.users = void 0;
exports.insertTollPaymentSchema = exports.insertTollPricingSchema = exports.insertTollLocationSchema = exports.insertFuelOrderSchema = exports.insertFuelInventorySchema = exports.insertBlacklistedEntitySchema = exports.insertUserActivitySchema = exports.insertReportSchema = exports.insertFraudAlertSchema = exports.insertReceiptSchema = exports.insertMfaConfigurationSchema = exports.insertPhoneVerificationSchema = exports.insertDriverVerificationSchema = exports.insertIdentityVerificationSchema = exports.insertSupportTicketSchema = exports.insertDriverNotificationSchema = exports.insertConsumerNotificationSchema = exports.insertMerchantNotificationSchema = exports.insertDeliveryRequestSchema = exports.insertDriverProfileSchema = exports.insertMerchantProfileSchema = exports.insertChatMessageSchema = exports.insertConversationSchema = exports.insertVendorPostSchema = exports.insertCartItemSchema = exports.insertOrderSchema = exports.insertProductSchema = exports.insertUserSchema = exports.receiptsRelations = exports.receipts = exports.tollPaymentsRelations = exports.tollPricingRelations = exports.tollLocationsRelations = exports.fuelOrdersRelations = exports.fuelInventoryRelations = exports.chatMessagesRelations = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_zod_1 = require("drizzle-zod");
const drizzle_orm_1 = require("drizzle-orm");
// Define an enum for user roles if it's not defined elsewhere
const roleEnum = (0, pg_core_1.pgEnum)("role", ["CONSUMER", "MERCHANT", "DRIVER"]);
exports.users = (0, pg_core_1.pgTable)("users", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.varchar)("user_id", { length: 50 }).notNull().unique(),
    fullName: (0, pg_core_1.varchar)("full_name", { length: 255 }).notNull(),
    email: (0, pg_core_1.varchar)("email", { length: 255 }).notNull().unique(),
    phone: (0, pg_core_1.varchar)("phone", { length: 20 }),
    password: (0, pg_core_1.varchar)("password", { length: 255 }), // Password can be null for social auth
    role: roleEnum("role").notNull().default("CONSUMER"),
    profilePicture: (0, pg_core_1.text)("profile_picture"),
    isVerified: (0, pg_core_1.boolean)("is_verified").default(false),
    isPhoneVerified: (0, pg_core_1.boolean)("is_phone_verified").default(false),
    isIdentityVerified: (0, pg_core_1.boolean)("is_identity_verified").default(false),
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
    city: (0, pg_core_1.varchar)("city", { length: 100 }),
    state: (0, pg_core_1.varchar)("state", { length: 100 }),
    country: (0, pg_core_1.varchar)("country", { length: 100 }).default('Nigeria'),
    latitude: (0, pg_core_1.decimal)('latitude', { precision: 10, scale: 8 }), // For geo-location
    longitude: (0, pg_core_1.decimal)('longitude', { precision: 11, scale: 8 }), // For geo-location
    address: (0, pg_core_1.text)('address'), // For geo-location
    bio: (0, pg_core_1.text)('bio'), // User biography/description
    socialAuth: (0, pg_core_1.jsonb)('social_auth'), // { provider: 'google' | 'facebook' | 'apple', providerId: string }
    lastLoginAt: (0, pg_core_1.timestamp)('last_login_at'), // For tracking login activity
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
});
exports.otpCodes = (0, pg_core_1.pgTable)("otp_codes", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    email: (0, pg_core_1.text)("email").notNull(),
    code: (0, pg_core_1.text)("code").notNull(),
    expiresAt: (0, pg_core_1.timestamp)("expires_at").notNull(),
    isUsed: (0, pg_core_1.boolean)("is_used").default(false),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
exports.userLocations = (0, pg_core_1.pgTable)("user_locations", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.integer)("user_id").notNull().references(() => exports.users.id),
    latitude: (0, pg_core_1.decimal)("latitude", { precision: 10, scale: 8 }).notNull(),
    longitude: (0, pg_core_1.decimal)("longitude", { precision: 11, scale: 8 }).notNull(),
    address: (0, pg_core_1.text)("address"),
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.categories = (0, pg_core_1.pgTable)("categories", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    name: (0, pg_core_1.text)("name").notNull(),
    icon: (0, pg_core_1.text)("icon").notNull(),
    slug: (0, pg_core_1.text)("slug").notNull().unique(),
    description: (0, pg_core_1.text)("description"),
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
exports.products = (0, pg_core_1.pgTable)("products", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    name: (0, pg_core_1.text)("name").notNull(),
    description: (0, pg_core_1.text)("description").notNull(),
    price: (0, pg_core_1.decimal)("price", { precision: 12, scale: 2 }).notNull(),
    unit: (0, pg_core_1.text)("unit").notNull(),
    categoryId: (0, pg_core_1.integer)("category_id").notNull().references(() => exports.categories.id),
    sellerId: (0, pg_core_1.integer)("seller_id").notNull().references(() => exports.users.id),
    image: (0, pg_core_1.text)("image"),
    rating: (0, pg_core_1.decimal)("rating", { precision: 3, scale: 2 }).default("0"),
    reviewCount: (0, pg_core_1.integer)("review_count").default(0),
    inStock: (0, pg_core_1.boolean)("in_stock").default(true),
    minimumOrder: (0, pg_core_1.integer)("minimum_order").default(1),
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.orders = (0, pg_core_1.pgTable)("orders", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    buyerId: (0, pg_core_1.integer)("buyer_id").notNull().references(() => exports.users.id),
    sellerId: (0, pg_core_1.integer)("seller_id").notNull().references(() => exports.users.id),
    productId: (0, pg_core_1.uuid)("product_id").notNull().references(() => exports.products.id),
    quantity: (0, pg_core_1.integer)("quantity").notNull(),
    totalPrice: (0, pg_core_1.decimal)("total_price", { precision: 12, scale: 2 }).notNull(),
    status: (0, pg_core_1.text)("status", { enum: ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "failed"] }).default("pending"),
    paymentTxRef: (0, pg_core_1.text)("payment_tx_ref"),
    deliveryAddress: (0, pg_core_1.text)("delivery_address").notNull(),
    driverId: (0, pg_core_1.integer)("driver_id").references(() => exports.users.id),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.cartItems = (0, pg_core_1.pgTable)("cart_items", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.integer)("user_id").notNull().references(() => exports.users.id),
    productId: (0, pg_core_1.uuid)("product_id").notNull().references(() => exports.products.id),
    quantity: (0, pg_core_1.integer)("quantity").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
exports.vendorPosts = (0, pg_core_1.pgTable)("vendor_posts", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    vendorId: (0, pg_core_1.integer)("vendor_id").notNull().references(() => exports.users.id),
    title: (0, pg_core_1.text)("title").notNull(),
    content: (0, pg_core_1.text)("content").notNull(),
    postType: (0, pg_core_1.text)("post_type", { enum: ["PRODUCT_UPDATE", "NEW_PRODUCT", "PROMOTION", "ANNOUNCEMENT", "RESTOCK"] }).notNull(),
    productId: (0, pg_core_1.uuid)("product_id").references(() => exports.products.id),
    images: (0, pg_core_1.text)("images").array(),
    tags: (0, pg_core_1.text)("tags").array(),
    originalPrice: (0, pg_core_1.decimal)("original_price", { precision: 12, scale: 2 }),
    discountPrice: (0, pg_core_1.decimal)("discount_price", { precision: 12, scale: 2 }),
    discountPercentage: (0, pg_core_1.integer)("discount_percentage"),
    validUntil: (0, pg_core_1.timestamp)("valid_until"),
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
    viewCount: (0, pg_core_1.integer)("view_count").default(0),
    likeCount: (0, pg_core_1.integer)("like_count").default(0),
    commentCount: (0, pg_core_1.integer)("comment_count").default(0),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.vendorPostLikes = (0, pg_core_1.pgTable)("vendor_post_likes", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    postId: (0, pg_core_1.uuid)("post_id").notNull().references(() => exports.vendorPosts.id),
    userId: (0, pg_core_1.integer)("user_id").notNull().references(() => exports.users.id),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
exports.vendorPostComments = (0, pg_core_1.pgTable)("vendor_post_comments", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    postId: (0, pg_core_1.uuid)("post_id").notNull().references(() => exports.vendorPosts.id),
    userId: (0, pg_core_1.integer)("user_id").notNull().references(() => exports.users.id),
    content: (0, pg_core_1.text)("content").notNull(),
    parentCommentId: (0, pg_core_1.integer)("parent_comment_id"),
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.conversations = (0, pg_core_1.pgTable)("conversations", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    customerId: (0, pg_core_1.integer)("customer_id").notNull().references(() => exports.users.id),
    vendorId: (0, pg_core_1.integer)("vendor_id").notNull().references(() => exports.users.id),
    productId: (0, pg_core_1.uuid)("product_id").references(() => exports.products.id),
    conversationType: (0, pg_core_1.text)("conversation_type", { enum: ["QUOTE", "ORDER", "GENERAL"] }).notNull(),
    status: (0, pg_core_1.text)("status", { enum: ["ACTIVE", "CLOSED"] }).default("ACTIVE"),
    lastMessage: (0, pg_core_1.text)("last_message"),
    lastMessageAt: (0, pg_core_1.timestamp)("last_message_at").defaultNow(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.chatMessages = (0, pg_core_1.pgTable)("chat_messages", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    conversationId: (0, pg_core_1.uuid)("conversation_id").notNull().references(() => exports.conversations.id),
    senderId: (0, pg_core_1.integer)("sender_id").notNull().references(() => exports.users.id),
    content: (0, pg_core_1.text)("content").notNull(),
    messageType: (0, pg_core_1.text)("message_type", { enum: ["TEXT", "QUOTE_REQUEST", "QUOTE_RESPONSE", "ORDER_UPDATE"] }).default("TEXT"),
    attachedData: (0, pg_core_1.json)("attached_data"),
    isRead: (0, pg_core_1.boolean)("is_read").default(false),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.merchantProfiles = (0, pg_core_1.pgTable)("merchant_profiles", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.integer)("user_id").notNull().references(() => exports.users.id),
    businessName: (0, pg_core_1.text)("business_name").notNull(),
    businessType: (0, pg_core_1.text)("business_type", {
        enum: ["APPAREL", "ART_ENTERTAINMENT", "BEAUTY_COSMETICS", "EDUCATION", "EVENT_PLANNING",
            "FINANCE", "SUPERMARKET", "HOTEL", "MEDICAL_HEALTH", "NON_PROFIT", "OIL_GAS",
            "RESTAURANT", "SHOPPING_RETAIL", "TICKET", "TOLL_GATE", "VEHICLE_SERVICE", "OTHER"]
    }).notNull(),
    businessDescription: (0, pg_core_1.text)("business_description"),
    businessAddress: (0, pg_core_1.text)("business_address"),
    businessPhone: (0, pg_core_1.text)("business_phone"),
    businessEmail: (0, pg_core_1.text)("business_email"),
    businessLogo: (0, pg_core_1.text)("business_logo"),
    businessHours: (0, pg_core_1.json)("business_hours"),
    isVerified: (0, pg_core_1.boolean)("is_verified").default(false),
    subscriptionTier: (0, pg_core_1.text)("subscription_tier", { enum: ["BASIC", "PREMIUM", "ENTERPRISE"] }).default("BASIC"),
    subscriptionExpiry: (0, pg_core_1.timestamp)("subscription_expiry"),
    totalSales: (0, pg_core_1.decimal)("total_sales", { precision: 12, scale: 2 }).default("0"),
    totalOrders: (0, pg_core_1.integer)("total_orders").default(0),
    rating: (0, pg_core_1.decimal)("rating", { precision: 3, scale: 2 }).default("0"),
    reviewCount: (0, pg_core_1.integer)("review_count").default(0),
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.merchantAnalytics = (0, pg_core_1.pgTable)("merchant_analytics", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    merchantId: (0, pg_core_1.integer)("merchant_id").notNull().references(() => exports.users.id),
    date: (0, pg_core_1.timestamp)("date").defaultNow(),
    dailySales: (0, pg_core_1.decimal)("daily_sales", { precision: 12, scale: 2 }).default("0"),
    dailyOrders: (0, pg_core_1.integer)("daily_orders").default(0),
    dailyViews: (0, pg_core_1.integer)("daily_views").default(0),
    dailyClicks: (0, pg_core_1.integer)("daily_clicks").default(0),
    topProduct: (0, pg_core_1.uuid)("top_product").references(() => exports.products.id),
    peakHour: (0, pg_core_1.integer)("peak_hour"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
exports.driverProfiles = (0, pg_core_1.pgTable)("driver_profiles", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.integer)("user_id").notNull().references(() => exports.users.id),
    driverTier: (0, pg_core_1.text)("driver_tier", { enum: ["PREMIUM", "STANDARD"] }).notNull().default("STANDARD"),
    accessLevel: (0, pg_core_1.text)("access_level", { enum: ["RESTRICTED", "OPEN"] }).notNull().default("OPEN"),
    vehicleType: (0, pg_core_1.text)("vehicle_type", { enum: ["MOTORCYCLE", "CAR", "VAN", "TRUCK"] }).notNull(),
    vehiclePlate: (0, pg_core_1.text)("vehicle_plate").notNull(),
    vehicleModel: (0, pg_core_1.text)("vehicle_model"),
    vehicleYear: (0, pg_core_1.integer)("vehicle_year"),
    driverLicense: (0, pg_core_1.text)("driver_license").notNull(),
    vehicleDocuments: (0, pg_core_1.text)("vehicle_documents").array(),
    isAvailable: (0, pg_core_1.boolean)("is_available").default(true),
    currentLocation: (0, pg_core_1.json)("current_location"),
    serviceTypes: (0, pg_core_1.text)("service_types").array(),
    totalDeliveries: (0, pg_core_1.integer)("total_deliveries").default(0),
    totalEarnings: (0, pg_core_1.decimal)("total_earnings", { precision: 12, scale: 2 }).default("0"),
    rating: (0, pg_core_1.decimal)("rating", { precision: 3, scale: 2 }).default("0"),
    reviewCount: (0, pg_core_1.integer)("review_count").default(0),
    isVerified: (0, pg_core_1.boolean)("is_verified").default(false),
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
    backgroundCheckStatus: (0, pg_core_1.text)("background_check_status", { enum: ["PENDING", "APPROVED", "REJECTED"] }).default("PENDING"),
    securityClearance: (0, pg_core_1.text)("security_clearance", { enum: ["NONE", "BASIC", "HIGH", "MAXIMUM"] }).default("NONE"),
    bondInsurance: (0, pg_core_1.boolean)("bond_insurance").default(false),
    maxCargoValue: (0, pg_core_1.decimal)("max_cargo_value", { precision: 12, scale: 2 }).default("50000"),
    specializations: (0, pg_core_1.text)("specializations").array(),
    restrictedDeliveryTypes: (0, pg_core_1.text)("restricted_delivery_types").array(),
    tierSpecificBenefits: (0, pg_core_1.json)("tier_specific_benefits"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.deliveryRequests = (0, pg_core_1.pgTable)("delivery_requests", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    customerId: (0, pg_core_1.integer)("customer_id").notNull().references(() => exports.users.id),
    merchantId: (0, pg_core_1.integer)("merchant_id").references(() => exports.users.id),
    driverId: (0, pg_core_1.integer)("driver_id").references(() => exports.users.id),
    orderId: (0, pg_core_1.uuid)("order_id").references(() => exports.orders.id),
    deliveryType: (0, pg_core_1.text)("delivery_type", { enum: ["FUEL", "PACKAGE", "FOOD", "GROCERY", "JEWELRY", "ELECTRONICS", "DOCUMENTS", "PHARMACEUTICALS", "HIGH_VALUE", "OTHER"] }).notNull(),
    cargoValue: (0, pg_core_1.decimal)("cargo_value", { precision: 12, scale: 2 }).default("0"),
    requiresPremiumDriver: (0, pg_core_1.boolean)("requires_premium_driver").default(false),
    pickupAddress: (0, pg_core_1.text)("pickup_address").notNull(),
    deliveryAddress: (0, pg_core_1.text)("delivery_address").notNull(),
    pickupLocation: (0, pg_core_1.json)("pickup_location"),
    deliveryLocation: (0, pg_core_1.json)("delivery_location"),
    estimatedDistance: (0, pg_core_1.decimal)("estimated_distance", { precision: 8, scale: 2 }),
    estimatedDuration: (0, pg_core_1.integer)("estimated_duration"),
    deliveryFee: (0, pg_core_1.decimal)("delivery_fee", { precision: 10, scale: 2 }).notNull(),
    status: (0, pg_core_1.text)("status", { enum: ["PENDING", "ASSIGNED", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "CANCELLED"] }).default("PENDING"),
    scheduledPickupTime: (0, pg_core_1.timestamp)("scheduled_pickup_time"),
    actualPickupTime: (0, pg_core_1.timestamp)("actual_pickup_time"),
    estimatedDeliveryTime: (0, pg_core_1.timestamp)("estimated_delivery_time"),
    actualDeliveryTime: (0, pg_core_1.timestamp)("actual_delivery_time"),
    specialInstructions: (0, pg_core_1.text)("special_instructions"),
    trackingNumber: (0, pg_core_1.text)("tracking_number").unique(),
    proofOfDelivery: (0, pg_core_1.text)("proof_of_delivery"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// Merchant Notifications
exports.merchantNotifications = (0, pg_core_1.pgTable)("merchant_notifications", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.integer)("merchant_id").notNull().references(() => exports.users.id),
    title: (0, pg_core_1.text)("title").notNull(),
    message: (0, pg_core_1.text)("message").notNull(),
    type: (0, pg_core_1.text)("type", {
        enum: ["ORDER", "PAYMENT", "DELIVERY", "PROMOTION", "SYSTEM", "REVIEW"]
    }).notNull(),
    relatedId: (0, pg_core_1.uuid)("related_id"),
    isRead: (0, pg_core_1.boolean)("is_read").default(false),
    priority: (0, pg_core_1.text)("priority", { enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] }).default("MEDIUM"),
    actionUrl: (0, pg_core_1.text)("action_url"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    readAt: (0, pg_core_1.timestamp)("read_at"),
});
// Consumer Notifications
exports.consumerNotifications = (0, pg_core_1.pgTable)("consumer_notifications", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    consumerId: (0, pg_core_1.integer)("consumer_id").notNull().references(() => exports.users.id),
    title: (0, pg_core_1.text)("title").notNull(),
    message: (0, pg_core_1.text)("message").notNull(),
    type: (0, pg_core_1.text)("type", {
        enum: ["ORDER_STATUS", "DELIVERY_UPDATE", "PAYMENT", "PROMOTION", "SYSTEM", "REVIEW_REQUEST"]
    }).notNull(),
    relatedId: (0, pg_core_1.uuid)("related_id"),
    isRead: (0, pg_core_1.boolean)("is_read").default(false),
    priority: (0, pg_core_1.text)("priority", { enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] }).default("MEDIUM"),
    actionUrl: (0, pg_core_1.text)("action_url"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    readAt: (0, pg_core_1.timestamp)("read_at"),
});
// Driver Notifications
exports.driverNotifications = (0, pg_core_1.pgTable)("driver_notifications", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    driverId: (0, pg_core_1.integer)("driver_id").notNull().references(() => exports.users.id),
    title: (0, pg_core_1.text)("title").notNull(),
    message: (0, pg_core_1.text)("message").notNull(),
    type: (0, pg_core_1.text)("type", {
        enum: ["DELIVERY_REQUEST", "PAYOUT_CONFIRMATION", "STATUS_UPDATE", "SYSTEM", "RATING"]
    }).notNull(),
    relatedId: (0, pg_core_1.uuid)("related_id"),
    isRead: (0, pg_core_1.boolean)("is_read").default(false),
    priority: (0, pg_core_1.text)("priority", { enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] }).default("MEDIUM"),
    actionUrl: (0, pg_core_1.text)("action_url"),
    expiresAt: (0, pg_core_1.timestamp)("expires_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    readAt: (0, pg_core_1.timestamp)("read_at"),
});
// Support Tickets
exports.supportTickets = (0, pg_core_1.pgTable)("support_tickets", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    ticketNumber: (0, pg_core_1.text)("ticket_number").notNull().unique(),
    userId: (0, pg_core_1.integer)("user_id").references(() => exports.users.id),
    userRole: (0, pg_core_1.text)("user_role", { enum: ["CONSUMER", "MERCHANT", "DRIVER", "GUEST"] }).notNull(),
    name: (0, pg_core_1.text)("name").notNull(),
    email: (0, pg_core_1.text)("email").notNull(),
    subject: (0, pg_core_1.text)("subject").notNull(),
    message: (0, pg_core_1.text)("message").notNull(),
    status: (0, pg_core_1.text)("status", { enum: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] }).default("OPEN"),
    priority: (0, pg_core_1.text)("priority", { enum: ["LOW", "NORMAL", "HIGH", "URGENT"] }).default("NORMAL"),
    assignedTo: (0, pg_core_1.integer)("assigned_to").references(() => exports.users.id),
    adminNotes: (0, pg_core_1.text)("admin_notes"),
    resolution: (0, pg_core_1.text)("resolution"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
    resolvedAt: (0, pg_core_1.timestamp)("resolved_at"),
});
// Identity Verification tables
exports.identityVerifications = (0, pg_core_1.pgTable)("identity_verifications", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.integer)("user_id").references(() => exports.users.id).notNull(),
    verificationStatus: (0, pg_core_1.text)("verification_status", { enum: ["PENDING", "APPROVED", "REJECTED"] }).default("PENDING"),
    faceImageUrl: (0, pg_core_1.text)("face_image_url"),
    verificationDate: (0, pg_core_1.timestamp)("verification_date"),
    rejectionReason: (0, pg_core_1.text)("rejection_reason"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
exports.driverVerifications = (0, pg_core_1.pgTable)("driver_verifications", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.integer)("user_id").references(() => exports.users.id).notNull(),
    licenseNumber: (0, pg_core_1.text)("license_number").notNull(),
    licenseExpiryDate: (0, pg_core_1.text)("license_expiry_date").notNull(),
    licenseImageUrl: (0, pg_core_1.text)("license_image_url"),
    vehicleType: (0, pg_core_1.text)("vehicle_type").notNull(),
    vehiclePlate: (0, pg_core_1.text)("vehicle_plate").notNull(),
    vehicleModel: (0, pg_core_1.text)("vehicle_model"),
    vehicleYear: (0, pg_core_1.text)("vehicle_year"),
    verificationStatus: (0, pg_core_1.text)("verification_status", { enum: ["PENDING", "APPROVED", "REJECTED"] }).default("PENDING"),
    verificationDate: (0, pg_core_1.timestamp)("verification_date"),
    rejectionReason: (0, pg_core_1.text)("rejection_reason"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
exports.phoneVerifications = (0, pg_core_1.pgTable)("phone_verifications", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.integer)("user_id").references(() => exports.users.id).notNull(),
    phoneNumber: (0, pg_core_1.text)("phone_number").notNull(),
    otpCode: (0, pg_core_1.text)("otp_code").notNull(),
    isVerified: (0, pg_core_1.boolean)("is_verified").default(false),
    expiresAt: (0, pg_core_1.timestamp)("expires_at").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
// MFA (Multi-Factor Authentication) table
exports.mfaConfigurations = (0, pg_core_1.pgTable)("mfa_configurations", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.integer)("user_id").references(() => exports.users.id).notNull().unique(),
    isEnabled: (0, pg_core_1.boolean)("is_enabled").default(false),
    secret: (0, pg_core_1.text)("secret").notNull(),
    backupCodes: (0, pg_core_1.text)("backup_codes").array(),
    lastUsedAt: (0, pg_core_1.timestamp)("last_used_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// Trust & Safety - Fraud Detection
exports.fraudAlerts = (0, pg_core_1.pgTable)("fraud_alerts", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    userId: (0, pg_core_1.integer)("user_id").references(() => exports.users.id),
    alertType: (0, pg_core_1.text)("alert_type", {
        enum: ["PAYMENT_MISMATCH", "SUSPICIOUS_ACTIVITY", "VELOCITY_CHECK", "IP_CHANGE", "DEVICE_CHANGE", "UNUSUAL_TRANSACTION"]
    }).notNull(),
    severity: (0, pg_core_1.text)("severity", { enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] }).notNull(),
    description: (0, pg_core_1.text)("description").notNull(),
    metadata: (0, pg_core_1.jsonb)("metadata"), // Store additional context data
    isResolved: (0, pg_core_1.boolean)("is_resolved").default(false),
    resolvedBy: (0, pg_core_1.integer)("resolved_by").references(() => exports.users.id),
    resolvedAt: (0, pg_core_1.timestamp)("resolved_at"),
    resolution: (0, pg_core_1.text)("resolution"),
    ipAddress: (0, pg_core_1.text)("ip_address"),
    userAgent: (0, pg_core_1.text)("user_agent"),
    relatedTransactionId: (0, pg_core_1.text)("related_transaction_id"),
    riskScore: (0, pg_core_1.decimal)("risk_score", { precision: 3, scale: 2 }).default("0"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// Trust & Safety - Reports System
exports.reports = (0, pg_core_1.pgTable)("reports", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    reporterId: (0, pg_core_1.integer)("reporter_id").references(() => exports.users.id),
    reportedUserId: (0, pg_core_1.integer)("reported_user_id").references(() => exports.users.id),
    reportedProductId: (0, pg_core_1.uuid)("reported_product_id").references(() => exports.products.id),
    reportType: (0, pg_core_1.text)("report_type", {
        enum: ["USER_ABUSE", "PRODUCT_SCAM", "FAKE_LISTING", "INAPPROPRIATE_CONTENT", "FRAUD", "HARASSMENT", "SPAM", "OTHER"]
    }).notNull(),
    category: (0, pg_core_1.text)("category", {
        enum: ["SAFETY", "FRAUD", "CONTENT", "BEHAVIOR", "POLICY_VIOLATION"]
    }).notNull(),
    reason: (0, pg_core_1.text)("reason").notNull(),
    description: (0, pg_core_1.text)("description").notNull(),
    evidence: (0, pg_core_1.text)("evidence").array(), // URLs to screenshots, documents, etc.
    status: (0, pg_core_1.text)("status", {
        enum: ["PENDING", "UNDER_REVIEW", "RESOLVED", "DISMISSED", "ESCALATED"]
    }).default("PENDING"),
    priority: (0, pg_core_1.text)("priority", { enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] }).default("MEDIUM"),
    assignedTo: (0, pg_core_1.integer)("assigned_to").references(() => exports.users.id),
    adminNotes: (0, pg_core_1.text)("admin_notes"),
    resolution: (0, pg_core_1.text)("resolution"),
    actionTaken: (0, pg_core_1.text)("action_taken", {
        enum: ["NO_ACTION", "WARNING_SENT", "CONTENT_REMOVED", "USER_SUSPENDED", "USER_BANNED", "PRODUCT_REMOVED", "MERCHANT_RESTRICTED"]
    }),
    reporterAnonymous: (0, pg_core_1.boolean)("reporter_anonymous").default(false),
    ipAddress: (0, pg_core_1.text)("ip_address"),
    userAgent: (0, pg_core_1.text)("user_agent"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
    resolvedAt: (0, pg_core_1.timestamp)("resolved_at"),
});
// User Activity Tracking for Fraud Detection
exports.userActivities = (0, pg_core_1.pgTable)("user_activities", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    userId: (0, pg_core_1.integer)("user_id").references(() => exports.users.id).notNull(),
    activityType: (0, pg_core_1.text)("activity_type", {
        enum: ["LOGIN", "PAYMENT", "ORDER_PLACE", "PROFILE_UPDATE", "PASSWORD_CHANGE", "WITHDRAWAL", "REFUND"]
    }).notNull(),
    ipAddress: (0, pg_core_1.text)("ip_address"),
    userAgent: (0, pg_core_1.text)("user_agent"),
    deviceFingerprint: (0, pg_core_1.text)("device_fingerprint"),
    location: (0, pg_core_1.jsonb)("location"), // { country, city, lat, lng }
    sessionId: (0, pg_core_1.text)("session_id"),
    riskScore: (0, pg_core_1.decimal)("risk_score", { precision: 3, scale: 2 }).default("0"),
    flagged: (0, pg_core_1.boolean)("flagged").default(false),
    metadata: (0, pg_core_1.jsonb)("metadata"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
// Blacklisted Entities
exports.blacklistedEntities = (0, pg_core_1.pgTable)("blacklisted_entities", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    entityType: (0, pg_core_1.text)("entity_type", { enum: ["EMAIL", "PHONE", "IP", "DEVICE", "BANK_ACCOUNT"] }).notNull(),
    entityValue: (0, pg_core_1.text)("entity_value").notNull(),
    reason: (0, pg_core_1.text)("reason").notNull(),
    addedBy: (0, pg_core_1.integer)("added_by").references(() => exports.users.id).notNull(),
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
    expiresAt: (0, pg_core_1.timestamp)("expires_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// Fuel Inventory Schema
exports.fuelInventory = (0, pg_core_1.pgTable)('fuel_inventory', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    merchantId: (0, pg_core_1.integer)('merchant_id').notNull().references(() => exports.users.id),
    fuelType: (0, pg_core_1.text)('fuel_type', {
        enum: ['PETROL', 'DIESEL', 'KEROSENE', 'COOKING_GAS', 'INDUSTRIAL_GAS']
    }).notNull(),
    quantity: (0, pg_core_1.decimal)('quantity', { precision: 12, scale: 2 }).notNull(),
    unit: (0, pg_core_1.text)('unit', { enum: ['LITERS', 'GALLONS', 'KG', 'TONS'] }).notNull(),
    pricePerUnit: (0, pg_core_1.decimal)('price_per_unit', { precision: 10, scale: 2 }).notNull(),
    minimumOrderQuantity: (0, pg_core_1.decimal)('minimum_order_quantity', { precision: 10, scale: 2 }).default('1'),
    maximumOrderQuantity: (0, pg_core_1.decimal)('maximum_order_quantity', { precision: 12, scale: 2 }),
    isAvailable: (0, pg_core_1.boolean)('is_available').default(true),
    location: (0, pg_core_1.text)('location'),
    description: (0, pg_core_1.text)('description'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
});
// Fuel Orders Schema
exports.fuelOrders = (0, pg_core_1.pgTable)('fuel_orders', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    customerId: (0, pg_core_1.integer)('customer_id').notNull().references(() => exports.users.id),
    merchantId: (0, pg_core_1.integer)('merchant_id').notNull().references(() => exports.users.id),
    driverId: (0, pg_core_1.integer)('driver_id').references(() => exports.users.id),
    inventoryId: (0, pg_core_1.integer)('inventory_id').notNull().references(() => exports.fuelInventory.id),
    orderType: (0, pg_core_1.text)('order_type', { enum: ['BULK', 'SMALL_SCALE'] }).notNull(),
    fuelType: (0, pg_core_1.text)('fuel_type', {
        enum: ['PETROL', 'DIESEL', 'KEROSENE', 'COOKING_GAS', 'INDUSTRIAL_GAS']
    }).notNull(),
    quantity: (0, pg_core_1.decimal)('quantity', { precision: 12, scale: 2 }).notNull(),
    unit: (0, pg_core_1.text)('unit', { enum: ['LITERS', 'GALLONS', 'KG', 'TONS'] }).notNull(),
    pricePerUnit: (0, pg_core_1.decimal)('price_per_unit', { precision: 10, scale: 2 }).notNull(),
    totalPrice: (0, pg_core_1.decimal)('total_price', { precision: 12, scale: 2 }).notNull(),
    deliveryAddress: (0, pg_core_1.text)('delivery_address').notNull(),
    deliveryDate: (0, pg_core_1.timestamp)('delivery_date'),
    status: (0, pg_core_1.text)('status', {
        enum: ['PENDING', 'CONFIRMED', 'PROCESSING', 'DISPATCHED', 'DELIVERED', 'CANCELLED']
    }).default('PENDING'),
    paymentStatus: (0, pg_core_1.text)('payment_status', {
        enum: ['PENDING', 'PAID', 'REFUNDED']
    }).default('PENDING'),
    specialInstructions: (0, pg_core_1.text)('special_instructions'),
    orderNumber: (0, pg_core_1.text)('order_number').unique(),
    estimatedDeliveryTime: (0, pg_core_1.timestamp)('estimated_delivery_time'),
    actualDeliveryTime: (0, pg_core_1.timestamp)('actual_delivery_time'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
});
// Toll Gate Locations Schema
exports.tollLocations = (0, pg_core_1.pgTable)('toll_locations', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    name: (0, pg_core_1.text)('name').notNull(),
    location: (0, pg_core_1.text)('location').notNull(),
    address: (0, pg_core_1.text)('address').notNull(),
    latitude: (0, pg_core_1.decimal)('latitude', { precision: 10, scale: 8 }).notNull(),
    longitude: (0, pg_core_1.decimal)('longitude', { precision: 11, scale: 8 }).notNull(),
    operatorId: (0, pg_core_1.integer)('operator_id').references(() => exports.users.id),
    operatingHours: (0, pg_core_1.jsonb)('operating_hours'), // { start: '06:00', end: '22:00' }
    isActive: (0, pg_core_1.boolean)('is_active').default(true),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
});
// Toll Pricing Schema
exports.tollPricing = (0, pg_core_1.pgTable)('toll_pricing', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    locationId: (0, pg_core_1.integer)('location_id').notNull().references(() => exports.tollLocations.id),
    vehicleType: (0, pg_core_1.text)('vehicle_type', {
        enum: ['MOTORCYCLE', 'CAR', 'BUS', 'TRUCK', 'TRAILER']
    }).notNull(),
    price: (0, pg_core_1.decimal)('price', { precision: 10, scale: 2 }).notNull(),
    currency: (0, pg_core_1.text)('currency').default('NGN'),
    isActive: (0, pg_core_1.boolean)('is_active').default(true),
    validFrom: (0, pg_core_1.timestamp)('valid_from').defaultNow(),
    validTo: (0, pg_core_1.timestamp)('valid_to'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
});
// Toll Payments Schema
exports.tollPayments = (0, pg_core_1.pgTable)('toll_payments', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.integer)('user_id').notNull().references(() => exports.users.id),
    locationId: (0, pg_core_1.integer)('location_id').notNull().references(() => exports.tollLocations.id),
    vehicleType: (0, pg_core_1.text)('vehicle_type', {
        enum: ['MOTORCYCLE', 'CAR', 'BUS', 'TRUCK', 'TRAILER']
    }).notNull(),
    vehiclePlate: (0, pg_core_1.text)('vehicle_plate').notNull(),
    amount: (0, pg_core_1.decimal)('amount', { precision: 10, scale: 2 }).notNull(),
    currency: (0, pg_core_1.text)('currency').default('NGN'),
    paymentMethod: (0, pg_core_1.text)('payment_method', {
        enum: ['CARD', 'BANK_TRANSFER', 'WALLET', 'CASH']
    }).notNull(),
    paymentReference: (0, pg_core_1.text)('payment_reference').notNull().unique(),
    transactionId: (0, pg_core_1.text)('transaction_id'),
    status: (0, pg_core_1.text)('status', {
        enum: ['PENDING', 'SUCCESSFUL', 'FAILED', 'CANCELLED']
    }).default('PENDING'),
    receiptNumber: (0, pg_core_1.text)('receipt_number').unique(),
    qrCodeData: (0, pg_core_1.text)('qr_code_data'),
    qrCodeImageUrl: (0, pg_core_1.text)('qr_code_image_url'),
    paymentDate: (0, pg_core_1.timestamp)('payment_date').defaultNow(),
    verifiedAt: (0, pg_core_1.timestamp)('verified_at'),
    verifiedBy: (0, pg_core_1.integer)('verified_by').references(() => exports.users.id),
    metadata: (0, pg_core_1.jsonb)('metadata'), // Additional payment data
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
});
// Relations
exports.usersRelations = (0, drizzle_orm_1.relations)(exports.users, ({ many, one }) => ({
    products: many(exports.products),
    orders: many(exports.orders),
    cartItems: many(exports.cartItems),
    vendorPosts: many(exports.vendorPosts),
    vendorPostLikes: many(exports.vendorPostLikes),
    vendorPostComments: many(exports.vendorPostComments),
    merchantProfile: one(exports.merchantProfiles),
    driverProfile: one(exports.driverProfiles),
    userLocations: many(exports.userLocations),
    sentMessages: many(exports.chatMessages),
    customerConversations: many(exports.conversations, { relationName: "customerConversations" }),
    vendorConversations: many(exports.conversations, { relationName: "vendorConversations" }),
    deliveryRequests: many(exports.deliveryRequests),
    merchantNotifications: many(exports.merchantNotifications),
    consumerNotifications: many(exports.consumerNotifications),
    driverNotifications: many(exports.driverNotifications),
    supportTickets: many(exports.supportTickets),
    identityVerifications: many(exports.identityVerifications),
    driverVerifications: many(exports.driverVerifications),
    phoneVerifications: many(exports.phoneVerifications),
    mfaConfiguration: one(exports.mfaConfigurations),
    tollPayments: many(exports.tollPayments),
    operatedTollLocations: many(exports.tollLocations),
}));
exports.merchantNotificationsRelations = (0, drizzle_orm_1.relations)(exports.merchantNotifications, ({ one }) => ({
    merchant: one(exports.users, { fields: [exports.merchantNotifications.merchantId], references: [exports.users.id] }),
}));
exports.consumerNotificationsRelations = (0, drizzle_orm_1.relations)(exports.consumerNotifications, ({ one }) => ({
    consumer: one(exports.users, { fields: [exports.consumerNotifications.consumerId], references: [exports.users.id] }),
}));
exports.driverNotificationsRelations = (0, drizzle_orm_1.relations)(exports.driverNotifications, ({ one }) => ({
    driver: one(exports.users, { fields: [exports.driverNotifications.driverId], references: [exports.users.id] }),
}));
exports.supportTicketsRelations = (0, drizzle_orm_1.relations)(exports.supportTickets, ({ one }) => ({
    user: one(exports.users, { fields: [exports.supportTickets.userId], references: [exports.users.id] }),
    assignedTo: one(exports.users, { fields: [exports.supportTickets.assignedTo], references: [exports.users.id] }),
}));
exports.identityVerificationsRelations = (0, drizzle_orm_1.relations)(exports.identityVerifications, ({ one }) => ({
    user: one(exports.users, { fields: [exports.identityVerifications.userId], references: [exports.users.id] }),
}));
exports.driverVerificationsRelations = (0, drizzle_orm_1.relations)(exports.driverVerifications, ({ one }) => ({
    user: one(exports.users, { fields: [exports.driverVerifications.userId], references: [exports.users.id] }),
}));
exports.phoneVerificationsRelations = (0, drizzle_orm_1.relations)(exports.phoneVerifications, ({ one }) => ({
    user: one(exports.users, { fields: [exports.phoneVerifications.userId], references: [exports.users.id] }),
}));
exports.mfaConfigurationsRelations = (0, drizzle_orm_1.relations)(exports.mfaConfigurations, ({ one }) => ({
    user: one(exports.users, { fields: [exports.mfaConfigurations.userId], references: [exports.users.id] }),
}));
exports.fraudAlertsRelations = (0, drizzle_orm_1.relations)(exports.fraudAlerts, ({ one }) => ({
    user: one(exports.users, { fields: [exports.fraudAlerts.userId], references: [exports.users.id] }),
    resolvedBy: one(exports.users, { fields: [exports.fraudAlerts.resolvedBy], references: [exports.users.id] }),
}));
exports.reportsRelations = (0, drizzle_orm_1.relations)(exports.reports, ({ one }) => ({
    reporter: one(exports.users, { fields: [exports.reports.reporterId], references: [exports.users.id] }),
    reportedUser: one(exports.users, { fields: [exports.reports.reportedUserId], references: [exports.users.id] }),
    reportedProduct: one(exports.products, { fields: [exports.reports.reportedProductId], references: [exports.products.id] }),
    assignedTo: one(exports.users, { fields: [exports.reports.assignedTo], references: [exports.users.id] }),
}));
exports.userActivitiesRelations = (0, drizzle_orm_1.relations)(exports.userActivities, ({ one }) => ({
    user: one(exports.users, { fields: [exports.userActivities.userId], references: [exports.users.id] }),
}));
exports.blacklistedEntitiesRelations = (0, drizzle_orm_1.relations)(exports.blacklistedEntities, ({ one }) => ({
    addedBy: one(exports.users, { fields: [exports.blacklistedEntities.addedBy], references: [exports.users.id] }),
}));
exports.productsRelations = (0, drizzle_orm_1.relations)(exports.products, ({ one, many }) => ({
    category: one(exports.categories, { fields: [exports.products.categoryId], references: [exports.categories.id] }),
    seller: one(exports.users, { fields: [exports.products.sellerId], references: [exports.users.id] }),
    orders: many(exports.orders),
    cartItems: many(exports.cartItems),
    vendorPosts: many(exports.vendorPosts),
}));
exports.ordersRelations = (0, drizzle_orm_1.relations)(exports.orders, ({ one }) => ({
    buyer: one(exports.users, { fields: [exports.orders.buyerId], references: [exports.users.id] }),
    seller: one(exports.users, { fields: [exports.orders.sellerId], references: [exports.users.id] }),
    product: one(exports.products, { fields: [exports.orders.productId], references: [exports.products.id] }),
    driver: one(exports.users, { fields: [exports.orders.driverId], references: [exports.users.id] }),
}));
exports.vendorPostsRelations = (0, drizzle_orm_1.relations)(exports.vendorPosts, ({ one, many }) => ({
    vendor: one(exports.users, { fields: [exports.vendorPosts.vendorId], references: [exports.users.id] }),
    product: one(exports.products, { fields: [exports.vendorPosts.productId], references: [exports.products.id] }),
    likes: many(exports.vendorPostLikes),
    comments: many(exports.vendorPostComments),
}));
exports.conversationsRelations = (0, drizzle_orm_1.relations)(exports.conversations, ({ one, many }) => ({
    customer: one(exports.users, { fields: [exports.conversations.customerId], references: [exports.users.id], relationName: "customerConversations" }),
    vendor: one(exports.users, { fields: [exports.conversations.vendorId], references: [exports.users.id], relationName: "vendorConversations" }),
    product: one(exports.products, { fields: [exports.conversations.productId], references: [exports.products.id] }),
    messages: many(exports.chatMessages),
}));
exports.chatMessagesRelations = (0, drizzle_orm_1.relations)(exports.chatMessages, ({ one }) => ({
    conversation: one(exports.conversations, { fields: [exports.chatMessages.conversationId], references: [exports.conversations.id] }),
    sender: one(exports.users, { fields: [exports.chatMessages.senderId], references: [exports.users.id] }),
}));
// Fuel Inventory Relations
exports.fuelInventoryRelations = (0, drizzle_orm_1.relations)(exports.fuelInventory, ({ one, many }) => ({
    merchant: one(exports.users, { fields: [exports.fuelInventory.merchantId], references: [exports.users.id] }),
    fuelOrders: many(exports.fuelOrders),
}));
// Fuel Orders Relations
exports.fuelOrdersRelations = (0, drizzle_orm_1.relations)(exports.fuelOrders, ({ one }) => ({
    customer: one(exports.users, { fields: [exports.fuelOrders.customerId], references: [exports.users.id] }),
    merchant: one(exports.users, { fields: [exports.fuelOrders.merchantId], references: [exports.users.id] }),
    driver: one(exports.users, { fields: [exports.fuelOrders.driverId], references: [exports.users.id] }),
    inventory: one(exports.fuelInventory, { fields: [exports.fuelOrders.inventoryId], references: [exports.fuelInventory.id] }),
}));
// Toll Location Relations
exports.tollLocationsRelations = (0, drizzle_orm_1.relations)(exports.tollLocations, ({ one, many }) => ({
    operator: one(exports.users, { fields: [exports.tollLocations.operatorId], references: [exports.users.id] }),
    pricing: many(exports.tollPricing),
    payments: many(exports.tollPayments),
}));
// Toll Pricing Relations
exports.tollPricingRelations = (0, drizzle_orm_1.relations)(exports.tollPricing, ({ one }) => ({
    location: one(exports.tollLocations, { fields: [exports.tollPricing.locationId], references: [exports.tollLocations.id] }),
}));
// Toll Payment Relations
exports.tollPaymentsRelations = (0, drizzle_orm_1.relations)(exports.tollPayments, ({ one }) => ({
    user: one(exports.users, { fields: [exports.tollPayments.userId], references: [exports.users.id] }),
    location: one(exports.tollLocations, { fields: [exports.tollPayments.locationId], references: [exports.tollLocations.id] }),
    verifiedBy: one(exports.users, { fields: [exports.tollPayments.verifiedBy], references: [exports.users.id] }),
}));
// Receipts table
exports.receipts = (0, pg_core_1.pgTable)("receipts", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    receiptNumber: (0, pg_core_1.text)("receipt_number").notNull().unique(),
    orderId: (0, pg_core_1.uuid)("order_id").notNull().references(() => exports.orders.id),
    customerId: (0, pg_core_1.integer)("customer_id").notNull().references(() => exports.users.id),
    merchantId: (0, pg_core_1.integer)("merchant_id").notNull().references(() => exports.users.id),
    driverId: (0, pg_core_1.integer)("driver_id").references(() => exports.users.id),
    totalAmount: (0, pg_core_1.decimal)("total_amount", { precision: 12, scale: 2 }).notNull(),
    paymentMethod: (0, pg_core_1.text)("payment_method").notNull(),
    paymentStatus: (0, pg_core_1.text)("payment_status", {
        enum: ["PENDING", "COMPLETED", "FAILED", "REFUNDED"]
    }).notNull().default("PENDING"),
    transactionRef: (0, pg_core_1.text)("transaction_ref"),
    qrCodeData: (0, pg_core_1.text)("qr_code_data").notNull(),
    qrCodeImageUrl: (0, pg_core_1.text)("qr_code_image_url"),
    receiptPdfUrl: (0, pg_core_1.text)("receipt_pdf_url"),
    deliveryStatus: (0, pg_core_1.text)("delivery_status", {
        enum: ["PENDING", "IN_TRANSIT", "DELIVERED", "FAILED"]
    }).default("PENDING"),
    deliveryVerifiedAt: (0, pg_core_1.timestamp)("delivery_verified_at"),
    deliveryVerifiedBy: (0, pg_core_1.integer)("delivery_verified_by").references(() => exports.users.id),
    merchantVerifiedAt: (0, pg_core_1.timestamp)("merchant_verified_at"),
    merchantVerifiedBy: (0, pg_core_1.integer)("merchant_verified_by").references(() => exports.users.id),
    adminVerifiedAt: (0, pg_core_1.timestamp)("admin_verified_at"),
    adminVerifiedBy: (0, pg_core_1.integer)("admin_verified_by").references(() => exports.users.id),
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
    metadata: (0, pg_core_1.json)("metadata"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// Receipt relations
exports.receiptsRelations = (0, drizzle_orm_1.relations)(exports.receipts, ({ one }) => ({
    order: one(exports.orders, {
        fields: [exports.receipts.orderId],
        references: [exports.orders.id],
    }),
    customer: one(exports.users, {
        fields: [exports.receipts.customerId],
        references: [exports.users.id],
    }),
    merchant: one(exports.users, {
        fields: [exports.receipts.merchantId],
        references: [exports.users.id],
    }),
    driver: one(exports.users, {
        fields: [exports.receipts.driverId],
        references: [exports.users.id],
    }),
}));
// Validation schemas
exports.insertUserSchema = (0, drizzle_zod_1.createInsertSchema)(exports.users);
exports.insertProductSchema = (0, drizzle_zod_1.createInsertSchema)(exports.products);
exports.insertOrderSchema = (0, drizzle_zod_1.createInsertSchema)(exports.orders);
exports.insertCartItemSchema = (0, drizzle_zod_1.createInsertSchema)(exports.cartItems);
exports.insertVendorPostSchema = (0, drizzle_zod_1.createInsertSchema)(exports.vendorPosts);
exports.insertConversationSchema = (0, drizzle_zod_1.createInsertSchema)(exports.conversations);
exports.insertChatMessageSchema = (0, drizzle_zod_1.createInsertSchema)(exports.chatMessages);
exports.insertMerchantProfileSchema = (0, drizzle_zod_1.createInsertSchema)(exports.merchantProfiles);
exports.insertDriverProfileSchema = (0, drizzle_zod_1.createInsertSchema)(exports.driverProfiles);
exports.insertDeliveryRequestSchema = (0, drizzle_zod_1.createInsertSchema)(exports.deliveryRequests);
exports.insertMerchantNotificationSchema = (0, drizzle_zod_1.createInsertSchema)(exports.merchantNotifications);
exports.insertConsumerNotificationSchema = (0, drizzle_zod_1.createInsertSchema)(exports.consumerNotifications);
exports.insertDriverNotificationSchema = (0, drizzle_zod_1.createInsertSchema)(exports.driverNotifications);
exports.insertSupportTicketSchema = (0, drizzle_zod_1.createInsertSchema)(exports.supportTickets);
exports.insertIdentityVerificationSchema = (0, drizzle_zod_1.createInsertSchema)(exports.identityVerifications);
exports.insertDriverVerificationSchema = (0, drizzle_zod_1.createInsertSchema)(exports.driverVerifications);
exports.insertPhoneVerificationSchema = (0, drizzle_zod_1.createInsertSchema)(exports.phoneVerifications);
exports.insertMfaConfigurationSchema = (0, drizzle_zod_1.createInsertSchema)(exports.mfaConfigurations);
exports.insertReceiptSchema = (0, drizzle_zod_1.createInsertSchema)(exports.receipts);
exports.insertFraudAlertSchema = (0, drizzle_zod_1.createInsertSchema)(exports.fraudAlerts);
exports.insertReportSchema = (0, drizzle_zod_1.createInsertSchema)(exports.reports);
exports.insertUserActivitySchema = (0, drizzle_zod_1.createInsertSchema)(exports.userActivities);
exports.insertBlacklistedEntitySchema = (0, drizzle_zod_1.createInsertSchema)(exports.blacklistedEntities);
exports.insertFuelInventorySchema = (0, drizzle_zod_1.createInsertSchema)(exports.fuelInventory);
exports.insertFuelOrderSchema = (0, drizzle_zod_1.createInsertSchema)(exports.fuelOrders);
exports.insertTollLocationSchema = (0, drizzle_zod_1.createInsertSchema)(exports.tollLocations);
exports.insertTollPricingSchema = (0, drizzle_zod_1.createInsertSchema)(exports.tollPricing);
exports.insertTollPaymentSchema = (0, drizzle_zod_1.createInsertSchema)(exports.tollPayments);
//# sourceMappingURL=index.js.map