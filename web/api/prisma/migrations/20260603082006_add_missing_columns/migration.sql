-- AlterTable
ALTER TABLE "invoices" ADD COLUMN "credit_note_id" TEXT;
ALTER TABLE "invoices" ADD COLUMN "credit_note_issued_at" DATETIME;
ALTER TABLE "invoices" ADD COLUMN "credit_note_status" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PaymentCheckout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "iyzico_token_hash" TEXT,
    "userId" TEXT NOT NULL,
    "organization_id" TEXT,
    "plan" TEXT NOT NULL,
    "billing_cycle" TEXT NOT NULL DEFAULT 'MONTHLY',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priceTry" TEXT NOT NULL,
    "payment_currency" TEXT NOT NULL DEFAULT 'TRY',
    "subscription_days" INTEGER NOT NULL DEFAULT 30,
    "coupon_id" TEXT,
    "discount_percent" INTEGER,
    "original_net_amount" TEXT,
    "extra_seats" INTEGER NOT NULL DEFAULT 0,
    "seats_only" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "refunded_at" DATETIME,
    "refund_reason" TEXT,
    "kdv_rate" REAL,
    "kdv_amount" TEXT,
    "net_amount" TEXT,
    "customer_country" TEXT,
    "invoice_status" TEXT,
    "card_country" TEXT,
    "card_bin" TEXT,
    "iyzico_payment_id" TEXT,
    "iyzico_payment_transaction_id" TEXT,
    CONSTRAINT "PaymentCheckout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PaymentCheckout_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PaymentCheckout" ("billing_cycle", "card_bin", "card_country", "completedAt", "conversationId", "createdAt", "customer_country", "id", "invoice_status", "iyzico_token_hash", "kdv_amount", "kdv_rate", "net_amount", "organization_id", "payment_currency", "plan", "priceTry", "refund_reason", "refunded_at", "status", "subscription_days", "userId") SELECT "billing_cycle", "card_bin", "card_country", "completedAt", "conversationId", "createdAt", "customer_country", "id", "invoice_status", "iyzico_token_hash", "kdv_amount", "kdv_rate", "net_amount", "organization_id", "payment_currency", "plan", "priceTry", "refund_reason", "refunded_at", "status", "subscription_days", "userId" FROM "PaymentCheckout";
DROP TABLE "PaymentCheckout";
ALTER TABLE "new_PaymentCheckout" RENAME TO "PaymentCheckout";
CREATE UNIQUE INDEX "PaymentCheckout_conversationId_key" ON "PaymentCheckout"("conversationId");
CREATE UNIQUE INDEX "PaymentCheckout_iyzico_token_hash_key" ON "PaymentCheckout"("iyzico_token_hash");
CREATE INDEX "PaymentCheckout_userId_idx" ON "PaymentCheckout"("userId");
CREATE INDEX "PaymentCheckout_organization_id_idx" ON "PaymentCheckout"("organization_id");
CREATE INDEX "PaymentCheckout_status_idx" ON "PaymentCheckout"("status");
CREATE INDEX "PaymentCheckout_userId_status_createdAt_idx" ON "PaymentCheckout"("userId", "status", "createdAt");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "name" TEXT,
    "googleId" TEXT,
    "avatar" TEXT,
    "passwordHash" TEXT,
    "authProvider" TEXT NOT NULL DEFAULT 'local',
    "role" TEXT NOT NULL DEFAULT 'USER',
    "org_role" TEXT NOT NULL DEFAULT 'OWNER',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" DATETIME,
    "verificationToken" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    "country" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "billing_address_line" TEXT,
    "billing_postal_code" TEXT,
    "tc_kimlik_no" TEXT,
    "tax_id" TEXT,
    "tax_office" TEXT,
    "company_name" TEXT,
    "invoice_type" TEXT,
    "billing_country_code" TEXT,
    "is_kvkk_consented" BOOLEAN NOT NULL DEFAULT false,
    "kvkk_consented_at" DATETIME,
    "distance_sales_consented_at" DATETIME,
    "withdrawal_waived_at" DATETIME,
    "total_refunds" INTEGER NOT NULL DEFAULT 0,
    "first_refunded_at" DATETIME,
    "last_refunded_at" DATETIME,
    "refund_abuse_flagged" BOOLEAN NOT NULL DEFAULT false,
    "refund_blocked_until" DATETIME,
    "free_limit_first_exceeded_at" DATETIME,
    "total_operations_count" INTEGER NOT NULL DEFAULT 0,
    "total_throttle_events_count" INTEGER NOT NULL DEFAULT 0,
    "tool_usage_counts_json" TEXT NOT NULL DEFAULT '{}',
    "total_upgrade_cta_impressions_count" INTEGER NOT NULL DEFAULT 0,
    "organization_id" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "is_team_member" BOOLEAN NOT NULL DEFAULT false,
    "team_owner_id" TEXT,
    "team_member_role" TEXT,
    "last_login_at" DATETIME,
    CONSTRAINT "User_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("authProvider", "avatar", "billing_address_line", "billing_country_code", "billing_postal_code", "city", "company_name", "country", "createdAt", "distance_sales_consented_at", "email", "first_name", "free_limit_first_exceeded_at", "googleId", "id", "invoice_type", "isVerified", "is_kvkk_consented", "is_team_member", "kvkk_consented_at", "last_name", "name", "org_role", "organization_id", "passwordHash", "phone", "plan", "preferredLanguage", "role", "tax_id", "tax_office", "tc_kimlik_no", "team_owner_id", "timezone", "tool_usage_counts_json", "total_operations_count", "total_throttle_events_count", "total_upgrade_cta_impressions_count", "updatedAt", "verificationToken", "verifiedAt", "withdrawal_waived_at") SELECT "authProvider", "avatar", "billing_address_line", "billing_country_code", "billing_postal_code", "city", "company_name", "country", "createdAt", "distance_sales_consented_at", "email", "first_name", "free_limit_first_exceeded_at", "googleId", "id", "invoice_type", "isVerified", "is_kvkk_consented", "is_team_member", "kvkk_consented_at", "last_name", "name", "org_role", "organization_id", "passwordHash", "phone", "plan", "preferredLanguage", "role", "tax_id", "tax_office", "tc_kimlik_no", "team_owner_id", "timezone", "tool_usage_counts_json", "total_operations_count", "total_throttle_events_count", "total_upgrade_cta_impressions_count", "updatedAt", "verificationToken", "verifiedAt", "withdrawal_waived_at" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
CREATE INDEX "User_organization_id_idx" ON "User"("organization_id");
CREATE INDEX "User_country_idx" ON "User"("country");
CREATE TABLE "new_app_settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "site_name" TEXT NOT NULL DEFAULT 'PDF PLATFORM',
    "logo_url" TEXT,
    "global_maintenance_mode" BOOLEAN NOT NULL DEFAULT false,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "seo_keywords" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_app_settings" ("created_at", "global_maintenance_mode", "id", "logo_url", "seo_description", "seo_keywords", "seo_title", "site_name", "updated_at") SELECT "created_at", "global_maintenance_mode", "id", "logo_url", "seo_description", "seo_keywords", "seo_title", "site_name", "updated_at" FROM "app_settings";
DROP TABLE "app_settings";
ALTER TABLE "new_app_settings" RENAME TO "app_settings";
CREATE TABLE "new_download_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "result_id" TEXT,
    "tool_id" TEXT NOT NULL,
    "client_ip" TEXT,
    "user_agent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "acked_at" DATETIME,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "download_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_download_logs" ("acked_at", "client_ip", "created_at", "id", "result_id", "status", "tool_id", "user_agent", "user_id") SELECT "acked_at", "client_ip", "created_at", "id", "result_id", "status", "tool_id", "user_agent", "user_id" FROM "download_logs";
DROP TABLE "download_logs";
ALTER TABLE "new_download_logs" RENAME TO "download_logs";
CREATE INDEX "download_logs_user_id_created_at_idx" ON "download_logs"("user_id", "created_at");
CREATE INDEX "download_logs_created_at_idx" ON "download_logs"("created_at");
CREATE INDEX "download_logs_client_ip_idx" ON "download_logs"("client_ip");
CREATE TABLE "new_operation_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "tool_type" TEXT NOT NULL,
    "file_count" INTEGER NOT NULL DEFAULT 1,
    "total_file_size_mb" REAL NOT NULL DEFAULT 0,
    "is_batch" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "processing_time_ms" INTEGER,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "operation_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "operation_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_operation_logs" ("created_at", "file_count", "id", "is_batch", "organization_id", "processing_time_ms", "status", "tool_type", "total_file_size_mb", "user_id") SELECT "created_at", "file_count", "id", "is_batch", "organization_id", "processing_time_ms", "status", "tool_type", "total_file_size_mb", "user_id" FROM "operation_logs";
DROP TABLE "operation_logs";
ALTER TABLE "new_operation_logs" RENAME TO "operation_logs";
CREATE INDEX "operation_logs_organization_id_created_at_idx" ON "operation_logs"("organization_id", "created_at");
CREATE INDEX "operation_logs_user_id_created_at_idx" ON "operation_logs"("user_id", "created_at");
CREATE INDEX "operation_logs_tool_type_idx" ON "operation_logs"("tool_type");
CREATE INDEX "operation_logs_organization_id_status_created_at_idx" ON "operation_logs"("organization_id", "status", "created_at");
CREATE TABLE "new_plan_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plan" TEXT NOT NULL,
    "daily_operation_limit" INTEGER,
    "monthly_operation_limit" INTEGER NOT NULL,
    "file_size_limit_mb" INTEGER NOT NULL,
    "batch_limit" INTEGER NOT NULL,
    "watermark_enabled" BOOLEAN NOT NULL,
    "queue_priority" TEXT NOT NULL,
    "allowed_tools" TEXT NOT NULL DEFAULT 'all',
    "max_seats" INTEGER NOT NULL,
    "monthly_price_try" INTEGER NOT NULL DEFAULT 0,
    "monthly_price_usd" INTEGER NOT NULL DEFAULT 0,
    "monthly_price_eur" INTEGER NOT NULL DEFAULT 0,
    "yearly_price_try" INTEGER NOT NULL DEFAULT 0,
    "yearly_price_usd" INTEGER NOT NULL DEFAULT 0,
    "yearly_price_eur" INTEGER NOT NULL DEFAULT 0,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_plan_configs" ("allowed_tools", "batch_limit", "daily_operation_limit", "file_size_limit_mb", "id", "max_seats", "monthly_operation_limit", "monthly_price_try", "monthly_price_usd", "plan", "queue_priority", "updated_at", "watermark_enabled", "yearly_price_try", "yearly_price_usd") SELECT "allowed_tools", "batch_limit", "daily_operation_limit", "file_size_limit_mb", "id", "max_seats", "monthly_operation_limit", "monthly_price_try", "monthly_price_usd", "plan", "queue_priority", "updated_at", "watermark_enabled", "yearly_price_try", "yearly_price_usd" FROM "plan_configs";
DROP TABLE "plan_configs";
ALTER TABLE "new_plan_configs" RENAME TO "plan_configs";
CREATE UNIQUE INDEX "plan_configs_plan_key" ON "plan_configs"("plan");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "DailyUsage_usageDate_idx" ON "DailyUsage"("usageDate");

-- CreateIndex
CREATE INDEX "DailyUsage_userId_usageDate_operationsCount_idx" ON "DailyUsage"("userId", "usageDate", "operationsCount");

-- CreateIndex
CREATE INDEX "coupon_uses_coupon_id_created_at_idx" ON "coupon_uses"("coupon_id", "created_at");

-- CreateIndex
CREATE INDEX "invitations_organization_id_expires_at_idx" ON "invitations"("organization_id", "expires_at");
