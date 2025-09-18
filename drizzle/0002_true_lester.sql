ALTER TABLE "reviews" DROP CONSTRAINT "reviews_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_order_id_orders_id_fk";
--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "id" SET DATA TYPE serial;--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "order_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "search_history" ALTER COLUMN "id" SET DATA TYPE serial;--> statement-breakpoint
ALTER TABLE "search_history" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "search_history" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "id" SET DATA TYPE serial;--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "status" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "currency" SET DATA TYPE varchar(3);--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "target_type" varchar(20) NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "target_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "search_history" ADD COLUMN "search_query" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "search_history" ADD COLUMN "search_type" varchar(50) DEFAULT 'GENERAL';--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "related_order_id" integer;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "related_transaction_id" integer;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "processed_by" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_related_order_id_orders_id_fk" FOREIGN KEY ("related_order_id") REFERENCES "orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "reviews" DROP COLUMN IF EXISTS "product_id";--> statement-breakpoint
ALTER TABLE "reviews" DROP COLUMN IF EXISTS "is_approved";--> statement-breakpoint
ALTER TABLE "reviews" DROP COLUMN IF EXISTS "is_rejected";--> statement-breakpoint
ALTER TABLE "reviews" DROP COLUMN IF EXISTS "is_flagged";--> statement-breakpoint
ALTER TABLE "reviews" DROP COLUMN IF EXISTS "rejection_reason";--> statement-breakpoint
ALTER TABLE "reviews" DROP COLUMN IF EXISTS "flag_reason";--> statement-breakpoint
ALTER TABLE "reviews" DROP COLUMN IF EXISTS "moderated_at";--> statement-breakpoint
ALTER TABLE "search_history" DROP COLUMN IF EXISTS "search_term";--> statement-breakpoint
ALTER TABLE "search_history" DROP COLUMN IF EXISTS "filters";--> statement-breakpoint
ALTER TABLE "search_history" DROP COLUMN IF EXISTS "is_saved";--> statement-breakpoint
ALTER TABLE "search_history" DROP COLUMN IF EXISTS "saved_name";--> statement-breakpoint
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "order_id";--> statement-breakpoint
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "initiated_at";