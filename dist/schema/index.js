"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertDeliveryRequestSchema = exports.insertDriverProfileSchema = exports.insertMerchantProfileSchema = exports.insertChatMessageSchema = exports.insertConversationSchema = exports.insertVendorPostSchema = exports.insertCartItemSchema = exports.insertOrderSchema = exports.insertProductSchema = exports.insertUserSchema = exports.chatMessagesRelations = exports.conversationsRelations = exports.vendorPostsRelations = exports.ordersRelations = exports.productsRelations = exports.usersRelations = exports.deliveryRequests = exports.driverProfiles = exports.merchantAnalytics = exports.merchantProfiles = exports.chatMessages = exports.conversations = exports.vendorPostComments = exports.vendorPostLikes = exports.vendorPosts = exports.cartItems = exports.orders = exports.products = exports.categories = exports.userLocations = exports.otpCodes = exports.users = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_zod_1 = require("drizzle-zod");
const drizzle_orm_1 = require("drizzle-orm");
exports.users = (0, pg_core_1.pgTable)("users", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.text)("user_id").notNull().unique(),
    fullName: (0, pg_core_1.text)("full_name").notNull(),
    email: (0, pg_core_1.text)("email").notNull().unique(),
    phone: (0, pg_core_1.text)("phone").notNull(),
    password: (0, pg_core_1.text)("password").notNull(),
    role: (0, pg_core_1.text)("role", { enum: ["CONSUMER", "MERCHANT", "DRIVER"] }).notNull(),
    isVerified: (0, pg_core_1.boolean)("is_verified").default(false),
    isPhoneVerified: (0, pg_core_1.boolean)("is_phone_verified").default(false),
    isIdentityVerified: (0, pg_core_1.boolean)("is_identity_verified").default(false),
    profilePicture: (0, pg_core_1.text)("profile_picture"),
    address: (0, pg_core_1.text)("address"),
    city: (0, pg_core_1.text)("city"),
    state: (0, pg_core_1.text)("state"),
    country: (0, pg_core_1.text)("country").default("Nigeria"),
    bio: (0, pg_core_1.text)("bio"),
    socialProvider: (0, pg_core_1.text)("social_provider"),
    socialId: (0, pg_core_1.text)("social_id"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
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
    status: (0, pg_core_1.text)("status", { enum: ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"] }).default("pending"),
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
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
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
//# sourceMappingURL=index.js.map