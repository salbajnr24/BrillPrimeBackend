CREATE TABLE IF NOT EXISTS "account_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"flag_type" varchar(50) NOT NULL,
	"severity" varchar(20) NOT NULL,
	"reason" text NOT NULL,
	"flagged_by" integer NOT NULL,
	"status" varchar(20) DEFAULT 'ACTIVE',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "business_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"image_url" varchar(500),
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp,
	CONSTRAINT "business_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "commodity_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"business_category_id" uuid NOT NULL,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "content_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reported_by" integer NOT NULL,
	"content_type" varchar(50) NOT NULL,
	"content_id" varchar(255) NOT NULL,
	"reason" text NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "moderation_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"admin_id" integer NOT NULL,
	"response" text NOT NULL,
	"action" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "opening_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" integer NOT NULL,
	"day_of_week" varchar(20),
	"open_time" varchar(10),
	"close_time" varchar(10),
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp,
	CONSTRAINT "opening_hours_vendor_id_day_of_week_unique" UNIQUE("vendor_id","day_of_week")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "qr_codes" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"amount" varchar(20) NOT NULL,
	"description" text,
	"status" varchar(20) DEFAULT 'ACTIVE',
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"used_by" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" integer NOT NULL,
	"merchant_id" integer,
	"product_id" uuid,
	"order_id" uuid,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "review_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"seller_id" integer NOT NULL,
	"response" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"product_id" uuid NOT NULL,
	"order_id" uuid,
	"rating" integer NOT NULL,
	"comment" text,
	"is_approved" boolean DEFAULT true,
	"is_rejected" boolean DEFAULT false,
	"is_flagged" boolean DEFAULT false,
	"rejection_reason" text,
	"flag_reason" text,
	"moderated_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "search_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer,
	"search_term" varchar(255) NOT NULL,
	"filters" json,
	"results_count" integer DEFAULT 0,
	"is_saved" boolean DEFAULT false,
	"saved_name" varchar(100),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "security_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer,
	"action" varchar(100) NOT NULL,
	"details" text,
	"ip_address" varchar(45),
	"user_agent" text,
	"severity" varchar(20) DEFAULT 'INFO',
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "suspicious_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer,
	"activity_type" varchar(50) NOT NULL,
	"description" text NOT NULL,
	"risk_indicators" json,
	"timestamp" timestamp DEFAULT now(),
	"ip_address" varchar(45),
	"device_fingerprint" text,
	"severity" varchar(20) DEFAULT 'MEDIUM'
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"recipient_id" integer,
	"order_id" uuid,
	"type" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'PENDING',
	"amount" varchar(20) NOT NULL,
	"fee" varchar(20) DEFAULT '0.00',
	"net_amount" varchar(20) NOT NULL,
	"currency" varchar(10) DEFAULT 'NGN',
	"payment_method" varchar(50),
	"transaction_ref" varchar(255),
	"description" text,
	"metadata" json,
	"initiated_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trending_searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"search_term" varchar(255) NOT NULL,
	"search_count" integer DEFAULT 1,
	"last_searched" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trusted_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"device_token" varchar(255) NOT NULL,
	"device_name" varchar(100),
	"device_type" varchar(50),
	"browser_info" text,
	"is_active" boolean DEFAULT true,
	"expires_at" timestamp NOT NULL,
	"last_used_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"balance" varchar(20) DEFAULT '0.00',
	"currency" varchar(10) DEFAULT 'NGN',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DROP TABLE "merchant_analytics";--> statement-breakpoint
DROP TABLE "reports";--> statement-breakpoint
DROP TABLE "user_activities";--> statement-breakpoint
ALTER TABLE "delivery_requests" DROP CONSTRAINT "delivery_requests_tracking_number_unique";--> statement-breakpoint
ALTER TABLE "fuel_orders" DROP CONSTRAINT "fuel_orders_order_number_unique";--> statement-breakpoint
ALTER TABLE "mfa_configurations" DROP CONSTRAINT "mfa_configurations_user_id_unique";--> statement-breakpoint
ALTER TABLE "toll_payments" DROP CONSTRAINT "toll_payments_payment_reference_unique";--> statement-breakpoint
ALTER TABLE "toll_payments" DROP CONSTRAINT "toll_payments_receipt_number_unique";--> statement-breakpoint
ALTER TABLE "blacklisted_entities" DROP CONSTRAINT "blacklisted_entities_added_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "fuel_orders" DROP CONSTRAINT "fuel_orders_driver_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "toll_locations" DROP CONSTRAINT "toll_locations_operator_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "toll_payments" DROP CONSTRAINT "toll_payments_verified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "blacklisted_entities" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "blacklisted_entities" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "blacklisted_entities" ALTER COLUMN "entity_type" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "blacklisted_entities" ALTER COLUMN "entity_value" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "cart_items" ALTER COLUMN "quantity" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "name" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "icon" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "icon" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "slug" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "chat_messages" ALTER COLUMN "message_type" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "consumer_notifications" ALTER COLUMN "title" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "consumer_notifications" ALTER COLUMN "type" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "consumer_notifications" ALTER COLUMN "type" SET DEFAULT 'GENERAL';--> statement-breakpoint
ALTER TABLE "consumer_notifications" ALTER COLUMN "type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "consumer_notifications" ALTER COLUMN "related_id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "consumer_notifications" ALTER COLUMN "priority" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "consumer_notifications" ALTER COLUMN "action_url" SET DATA TYPE varchar(500);--> statement-breakpoint
ALTER TABLE "conversations" ALTER COLUMN "vendor_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ALTER COLUMN "conversation_type" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "conversations" ALTER COLUMN "conversation_type" SET DEFAULT 'GENERAL';--> statement-breakpoint
ALTER TABLE "conversations" ALTER COLUMN "conversation_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ALTER COLUMN "status" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "conversations" ALTER COLUMN "last_message_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "delivery_requests" ALTER COLUMN "delivery_type" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "delivery_requests" ALTER COLUMN "cargo_value" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "delivery_requests" ALTER COLUMN "estimated_distance" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "delivery_requests" ALTER COLUMN "delivery_fee" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "delivery_requests" ALTER COLUMN "status" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "delivery_requests" ALTER COLUMN "tracking_number" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "driver_notifications" ALTER COLUMN "title" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "driver_notifications" ALTER COLUMN "type" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "driver_notifications" ALTER COLUMN "type" SET DEFAULT 'GENERAL';--> statement-breakpoint
ALTER TABLE "driver_notifications" ALTER COLUMN "type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "driver_notifications" ALTER COLUMN "related_id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "driver_notifications" ALTER COLUMN "priority" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "driver_notifications" ALTER COLUMN "action_url" SET DATA TYPE varchar(500);--> statement-breakpoint
ALTER TABLE "driver_profiles" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "driver_profiles" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "driver_profiles" ALTER COLUMN "driver_tier" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "driver_profiles" ALTER COLUMN "driver_tier" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "driver_profiles" ALTER COLUMN "vehicle_type" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "driver_profiles" ALTER COLUMN "vehicle_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "driver_profiles" ALTER COLUMN "vehicle_plate" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "driver_profiles" ALTER COLUMN "vehicle_plate" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "driver_profiles" ALTER COLUMN "vehicle_model" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "driver_profiles" ALTER COLUMN "vehicle_documents" SET DATA TYPE json;--> statement-breakpoint
ALTER TABLE "driver_profiles" ALTER COLUMN "is_available" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "driver_profiles" ALTER COLUMN "service_types" SET DATA TYPE json;--> statement-breakpoint
ALTER TABLE "driver_profiles" ALTER COLUMN "total_earnings" SET DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE "driver_profiles" ALTER COLUMN "rating" SET DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE "driver_profiles" ALTER COLUMN "background_check_status" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "driver_profiles" ALTER COLUMN "max_cargo_value" SET DATA TYPE numeric(10, 2);--> statement-breakpoint
ALTER TABLE "driver_profiles" ALTER COLUMN "max_cargo_value" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "driver_verifications" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "driver_verifications" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "driver_verifications" ALTER COLUMN "license_number" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "driver_verifications" ALTER COLUMN "license_expiry_date" SET DATA TYPE timestamp;--> statement-breakpoint
ALTER TABLE "driver_verifications" ALTER COLUMN "license_image_url" SET DATA TYPE varchar(500);--> statement-breakpoint
ALTER TABLE "driver_verifications" ALTER COLUMN "vehicle_type" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "driver_verifications" ALTER COLUMN "vehicle_plate" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "driver_verifications" ALTER COLUMN "vehicle_model" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "driver_verifications" ALTER COLUMN "vehicle_year" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "driver_verifications" ALTER COLUMN "verification_status" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "fraud_alerts" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "fraud_alerts" ALTER COLUMN "severity" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "fraud_alerts" ALTER COLUMN "metadata" SET DATA TYPE json;--> statement-breakpoint
ALTER TABLE "fraud_alerts" ALTER COLUMN "risk_score" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "fraud_alerts" ALTER COLUMN "risk_score" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "fuel_inventory" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "fuel_inventory" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "fuel_inventory" ALTER COLUMN "fuel_type" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "fuel_inventory" ALTER COLUMN "quantity" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "fuel_inventory" ALTER COLUMN "unit" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "fuel_inventory" ALTER COLUMN "unit" SET DEFAULT 'litres';--> statement-breakpoint
ALTER TABLE "fuel_inventory" ALTER COLUMN "unit" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "fuel_inventory" ALTER COLUMN "price_per_unit" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "fuel_inventory" ALTER COLUMN "minimum_order_quantity" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "fuel_inventory" ALTER COLUMN "minimum_order_quantity" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "fuel_inventory" ALTER COLUMN "maximum_order_quantity" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "fuel_orders" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "fuel_orders" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "fuel_orders" ALTER COLUMN "inventory_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "fuel_orders" ALTER COLUMN "order_type" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "fuel_orders" ALTER COLUMN "fuel_type" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "fuel_orders" ALTER COLUMN "quantity" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "fuel_orders" ALTER COLUMN "unit" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "fuel_orders" ALTER COLUMN "price_per_unit" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "fuel_orders" ALTER COLUMN "total_price" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "fuel_orders" ALTER COLUMN "status" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "fuel_orders" ALTER COLUMN "payment_status" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "fuel_orders" ALTER COLUMN "order_number" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "fuel_orders" ALTER COLUMN "order_number" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "identity_verifications" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "identity_verifications" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "identity_verifications" ALTER COLUMN "verification_status" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "identity_verifications" ALTER COLUMN "face_image_url" SET DATA TYPE varchar(500);--> statement-breakpoint
ALTER TABLE "identity_verifications" ALTER COLUMN "face_image_url" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "merchant_notifications" ALTER COLUMN "title" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "merchant_notifications" ALTER COLUMN "type" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "merchant_notifications" ALTER COLUMN "type" SET DEFAULT 'GENERAL';--> statement-breakpoint
ALTER TABLE "merchant_notifications" ALTER COLUMN "type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "merchant_notifications" ALTER COLUMN "related_id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "merchant_notifications" ALTER COLUMN "priority" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "merchant_notifications" ALTER COLUMN "action_url" SET DATA TYPE varchar(500);--> statement-breakpoint
ALTER TABLE "merchant_profiles" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "merchant_profiles" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "merchant_profiles" ALTER COLUMN "business_name" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "merchant_profiles" ALTER COLUMN "business_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "merchant_profiles" ALTER COLUMN "business_type" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "merchant_profiles" ALTER COLUMN "business_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "merchant_profiles" ALTER COLUMN "business_phone" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "merchant_profiles" ALTER COLUMN "business_email" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "merchant_profiles" ALTER COLUMN "total_sales" SET DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE "merchant_profiles" ALTER COLUMN "rating" SET DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE "mfa_configurations" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "mfa_configurations" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "mfa_configurations" ALTER COLUMN "secret" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "mfa_configurations" ALTER COLUMN "backup_codes" SET DATA TYPE json;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "total_price" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "payment_tx_ref" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "delivery_address" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "phone_verifications" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "phone_verifications" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "name" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "description" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "price" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "unit" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "unit" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "category_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "rating" SET DATA TYPE varchar(10);--> statement-breakpoint
ALTER TABLE "receipts" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "receipts" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "receipts" ALTER COLUMN "receipt_number" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "receipts" ALTER COLUMN "total_amount" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "receipts" ALTER COLUMN "payment_method" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "receipts" ALTER COLUMN "payment_status" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "receipts" ALTER COLUMN "payment_status" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "receipts" ALTER COLUMN "transaction_ref" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "receipts" ALTER COLUMN "qr_code_data" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "receipts" ALTER COLUMN "qr_code_image_url" SET DATA TYPE varchar(500);--> statement-breakpoint
ALTER TABLE "receipts" ALTER COLUMN "receipt_pdf_url" SET DATA TYPE varchar(500);--> statement-breakpoint
ALTER TABLE "receipts" ALTER COLUMN "delivery_status" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "support_tickets" ALTER COLUMN "ticket_number" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "support_tickets" ALTER COLUMN "user_role" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "support_tickets" ALTER COLUMN "user_role" SET DEFAULT 'GUEST';--> statement-breakpoint
ALTER TABLE "support_tickets" ALTER COLUMN "user_role" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "support_tickets" ALTER COLUMN "name" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "support_tickets" ALTER COLUMN "email" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "support_tickets" ALTER COLUMN "subject" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "support_tickets" ALTER COLUMN "status" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "support_tickets" ALTER COLUMN "priority" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "toll_locations" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "toll_locations" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "toll_locations" ALTER COLUMN "name" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "toll_locations" ALTER COLUMN "location" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "toll_locations" ALTER COLUMN "latitude" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "toll_locations" ALTER COLUMN "longitude" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "toll_locations" ALTER COLUMN "operating_hours" SET DATA TYPE json;--> statement-breakpoint
ALTER TABLE "toll_payments" ALTER COLUMN "location_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "toll_payments" ALTER COLUMN "vehicle_type" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "toll_payments" ALTER COLUMN "vehicle_plate" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "toll_payments" ALTER COLUMN "amount" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "toll_payments" ALTER COLUMN "payment_method" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "toll_payments" ALTER COLUMN "status" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "toll_payments" ALTER COLUMN "status" SET DEFAULT 'COMPLETED';--> statement-breakpoint
ALTER TABLE "toll_payments" ALTER COLUMN "receipt_number" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "toll_payments" ALTER COLUMN "receipt_number" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "toll_pricing" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "toll_pricing" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "toll_pricing" ALTER COLUMN "location_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "toll_pricing" ALTER COLUMN "vehicle_type" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "toll_pricing" ALTER COLUMN "price" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "toll_pricing" ALTER COLUMN "currency" SET DATA TYPE varchar(10);--> statement-breakpoint
ALTER TABLE "vendor_post_comments" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "vendor_post_comments" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "vendor_post_comments" ALTER COLUMN "parent_comment_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "vendor_post_likes" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "vendor_post_likes" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "vendor_posts" ALTER COLUMN "title" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "vendor_posts" ALTER COLUMN "post_type" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "vendor_posts" ALTER COLUMN "images" SET DATA TYPE json;--> statement-breakpoint
ALTER TABLE "vendor_posts" ALTER COLUMN "tags" SET DATA TYPE json;--> statement-breakpoint
ALTER TABLE "vendor_posts" ALTER COLUMN "original_price" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "vendor_posts" ALTER COLUMN "discount_price" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "blacklisted_entities" ADD COLUMN "blacklisted_by" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "cart_items" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "cart_items" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "read_at" timestamp;--> statement-breakpoint
ALTER TABLE "consumer_notifications" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "consumer_notifications" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "assigned_to" integer;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "subject" varchar(255);--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "priority" varchar(20) DEFAULT 'MEDIUM';--> statement-breakpoint
ALTER TABLE "driver_notifications" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "driver_profiles" ADD COLUMN "license_number" varchar(50);--> statement-breakpoint
ALTER TABLE "driver_profiles" ADD COLUMN "license_expiry" timestamp;--> statement-breakpoint
ALTER TABLE "driver_profiles" ADD COLUMN "vehicle_color" varchar(50);--> statement-breakpoint
ALTER TABLE "driver_profiles" ADD COLUMN "current_latitude" numeric(10, 8);--> statement-breakpoint
ALTER TABLE "driver_profiles" ADD COLUMN "current_longitude" numeric(11, 8);--> statement-breakpoint
ALTER TABLE "driver_profiles" ADD COLUMN "completed_deliveries" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "driver_profiles" ADD COLUMN "online_hours" numeric(8, 2) DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE "driver_profiles" ADD COLUMN "verification_status" varchar(50) DEFAULT 'PENDING';--> statement-breakpoint
ALTER TABLE "driver_verifications" ADD COLUMN "verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "driver_verifications" ADD COLUMN "verified_by" integer;--> statement-breakpoint
ALTER TABLE "driver_verifications" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "fraud_alerts" ADD COLUMN "type" varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE "fraud_alerts" ADD COLUMN "status" varchar(20) DEFAULT 'ACTIVE';--> statement-breakpoint
ALTER TABLE "fraud_alerts" ADD COLUMN "title" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "fraud_alerts" ADD COLUMN "detected_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "identity_verifications" ADD COLUMN "verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "identity_verifications" ADD COLUMN "verified_by" integer;--> statement-breakpoint
ALTER TABLE "identity_verifications" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "merchant_notifications" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "merchant_notifications" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "merchant_profiles" ADD COLUMN "business_website" varchar(255);--> statement-breakpoint
ALTER TABLE "merchant_profiles" ADD COLUMN "social_media" json;--> statement-breakpoint
ALTER TABLE "merchant_profiles" ADD COLUMN "business_license" varchar(255);--> statement-breakpoint
ALTER TABLE "merchant_profiles" ADD COLUMN "tax_number" varchar(100);--> statement-breakpoint
ALTER TABLE "merchant_profiles" ADD COLUMN "bank_details" json;--> statement-breakpoint
ALTER TABLE "merchant_profiles" ADD COLUMN "verification_status" varchar(50) DEFAULT 'PENDING';--> statement-breakpoint
ALTER TABLE "merchant_profiles" ADD COLUMN "verification_notes" text;--> statement-breakpoint
ALTER TABLE "merchant_profiles" ADD COLUMN "commission_rate" numeric(5, 2) DEFAULT '5.00';--> statement-breakpoint
ALTER TABLE "merchant_profiles" ADD COLUMN "business_category_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_status" varchar(50) DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "special_instructions" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "estimated_delivery_date" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "actual_delivery_date" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tracking_number" varchar(100);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "order_notes" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancel_reason" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refund_amount" varchar(20);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refund_status" varchar(50);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "metadata" json;--> statement-breakpoint
ALTER TABLE "phone_verifications" ADD COLUMN "phone" varchar(20) NOT NULL;--> statement-breakpoint
ALTER TABLE "phone_verifications" ADD COLUMN "otp" varchar(10) NOT NULL;--> statement-breakpoint
ALTER TABLE "phone_verifications" ADD COLUMN "verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "quantity" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "vendor_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "images" json;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "maximum_order" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "weight" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "dimensions" json;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "tags" json;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "discount_price" varchar(20);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "discount_percentage" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "available_from" timestamp;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "available_until" timestamp;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "featured" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "seo_title" varchar(255);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "seo_description" text;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "resolved_by" integer;--> statement-breakpoint
ALTER TABLE "toll_payments" ADD COLUMN "transaction_ref" varchar(255);--> statement-breakpoint
ALTER TABLE "toll_payments" ADD COLUMN "qr_code_url" varchar(500);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "blacklisted_entities" ADD CONSTRAINT "blacklisted_entities_blacklisted_by_users_id_fk" FOREIGN KEY ("blacklisted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "driver_verifications" ADD CONSTRAINT "driver_verifications_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity_verifications" ADD CONSTRAINT "identity_verifications_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "merchant_profiles" ADD CONSTRAINT "merchant_profiles_business_category_id_business_categories_id_fk" FOREIGN KEY ("business_category_id") REFERENCES "business_categories"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "products" ADD CONSTRAINT "products_vendor_id_users_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "blacklisted_entities" DROP COLUMN IF EXISTS "added_by";--> statement-breakpoint
ALTER TABLE "blacklisted_entities" DROP COLUMN IF EXISTS "expires_at";--> statement-breakpoint
ALTER TABLE "blacklisted_entities" DROP COLUMN IF EXISTS "updated_at";--> statement-breakpoint
ALTER TABLE "chat_messages" DROP COLUMN IF EXISTS "updated_at";--> statement-breakpoint
ALTER TABLE "delivery_requests" DROP COLUMN IF EXISTS "pickup_location";--> statement-breakpoint
ALTER TABLE "delivery_requests" DROP COLUMN IF EXISTS "delivery_location";--> statement-breakpoint
ALTER TABLE "delivery_requests" DROP COLUMN IF EXISTS "estimated_delivery_time";--> statement-breakpoint
ALTER TABLE "delivery_requests" DROP COLUMN IF EXISTS "proof_of_delivery";--> statement-breakpoint
ALTER TABLE "driver_profiles" DROP COLUMN IF EXISTS "access_level";--> statement-breakpoint
ALTER TABLE "driver_profiles" DROP COLUMN IF EXISTS "driver_license";--> statement-breakpoint
ALTER TABLE "driver_profiles" DROP COLUMN IF EXISTS "current_location";--> statement-breakpoint
ALTER TABLE "driver_profiles" DROP COLUMN IF EXISTS "total_deliveries";--> statement-breakpoint
ALTER TABLE "driver_profiles" DROP COLUMN IF EXISTS "review_count";--> statement-breakpoint
ALTER TABLE "driver_profiles" DROP COLUMN IF EXISTS "security_clearance";--> statement-breakpoint
ALTER TABLE "driver_profiles" DROP COLUMN IF EXISTS "bond_insurance";--> statement-breakpoint
ALTER TABLE "driver_profiles" DROP COLUMN IF EXISTS "specializations";--> statement-breakpoint
ALTER TABLE "driver_profiles" DROP COLUMN IF EXISTS "restricted_delivery_types";--> statement-breakpoint
ALTER TABLE "driver_profiles" DROP COLUMN IF EXISTS "tier_specific_benefits";--> statement-breakpoint
ALTER TABLE "driver_verifications" DROP COLUMN IF EXISTS "verification_date";--> statement-breakpoint
ALTER TABLE "fraud_alerts" DROP COLUMN IF EXISTS "alert_type";--> statement-breakpoint
ALTER TABLE "fraud_alerts" DROP COLUMN IF EXISTS "is_resolved";--> statement-breakpoint
ALTER TABLE "fraud_alerts" DROP COLUMN IF EXISTS "resolution";--> statement-breakpoint
ALTER TABLE "fraud_alerts" DROP COLUMN IF EXISTS "ip_address";--> statement-breakpoint
ALTER TABLE "fraud_alerts" DROP COLUMN IF EXISTS "user_agent";--> statement-breakpoint
ALTER TABLE "fraud_alerts" DROP COLUMN IF EXISTS "related_transaction_id";--> statement-breakpoint
ALTER TABLE "fuel_inventory" DROP COLUMN IF EXISTS "location";--> statement-breakpoint
ALTER TABLE "fuel_inventory" DROP COLUMN IF EXISTS "description";--> statement-breakpoint
ALTER TABLE "fuel_orders" DROP COLUMN IF EXISTS "driver_id";--> statement-breakpoint
ALTER TABLE "identity_verifications" DROP COLUMN IF EXISTS "verification_date";--> statement-breakpoint
ALTER TABLE "merchant_profiles" DROP COLUMN IF EXISTS "business_logo";--> statement-breakpoint
ALTER TABLE "merchant_profiles" DROP COLUMN IF EXISTS "subscription_tier";--> statement-breakpoint
ALTER TABLE "merchant_profiles" DROP COLUMN IF EXISTS "subscription_expiry";--> statement-breakpoint
ALTER TABLE "merchant_profiles" DROP COLUMN IF EXISTS "total_orders";--> statement-breakpoint
ALTER TABLE "merchant_profiles" DROP COLUMN IF EXISTS "is_active";--> statement-breakpoint
ALTER TABLE "phone_verifications" DROP COLUMN IF EXISTS "phone_number";--> statement-breakpoint
ALTER TABLE "phone_verifications" DROP COLUMN IF EXISTS "otp_code";--> statement-breakpoint
ALTER TABLE "receipts" DROP COLUMN IF EXISTS "is_active";--> statement-breakpoint
ALTER TABLE "support_tickets" DROP COLUMN IF EXISTS "admin_notes";--> statement-breakpoint
ALTER TABLE "toll_locations" DROP COLUMN IF EXISTS "operator_id";--> statement-breakpoint
ALTER TABLE "toll_payments" DROP COLUMN IF EXISTS "currency";--> statement-breakpoint
ALTER TABLE "toll_payments" DROP COLUMN IF EXISTS "payment_reference";--> statement-breakpoint
ALTER TABLE "toll_payments" DROP COLUMN IF EXISTS "transaction_id";--> statement-breakpoint
ALTER TABLE "toll_payments" DROP COLUMN IF EXISTS "qr_code_data";--> statement-breakpoint
ALTER TABLE "toll_payments" DROP COLUMN IF EXISTS "qr_code_image_url";--> statement-breakpoint
ALTER TABLE "toll_payments" DROP COLUMN IF EXISTS "payment_date";--> statement-breakpoint
ALTER TABLE "toll_payments" DROP COLUMN IF EXISTS "verified_at";--> statement-breakpoint
ALTER TABLE "toll_payments" DROP COLUMN IF EXISTS "verified_by";--> statement-breakpoint
ALTER TABLE "toll_payments" DROP COLUMN IF EXISTS "metadata";--> statement-breakpoint
ALTER TABLE "toll_payments" DROP COLUMN IF EXISTS "updated_at";--> statement-breakpoint
ALTER TABLE "toll_pricing" DROP COLUMN IF EXISTS "valid_from";--> statement-breakpoint
ALTER TABLE "toll_pricing" DROP COLUMN IF EXISTS "valid_to";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "account_flags" ADD CONSTRAINT "account_flags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "account_flags" ADD CONSTRAINT "account_flags_flagged_by_users_id_fk" FOREIGN KEY ("flagged_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commodity_categories" ADD CONSTRAINT "commodity_categories_business_category_id_business_categories_id_fk" FOREIGN KEY ("business_category_id") REFERENCES "business_categories"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "moderation_responses" ADD CONSTRAINT "moderation_responses_report_id_content_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "content_reports"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "moderation_responses" ADD CONSTRAINT "moderation_responses_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "opening_hours" ADD CONSTRAINT "opening_hours_vendor_id_users_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ratings" ADD CONSTRAINT "ratings_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ratings" ADD CONSTRAINT "ratings_merchant_id_users_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ratings" ADD CONSTRAINT "ratings_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ratings" ADD CONSTRAINT "ratings_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "review_responses" ADD CONSTRAINT "review_responses_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "review_responses" ADD CONSTRAINT "review_responses_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "search_history" ADD CONSTRAINT "search_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "security_logs" ADD CONSTRAINT "security_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "suspicious_activities" ADD CONSTRAINT "suspicious_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
