-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "billing_cycle" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "iyzico_customer_id" TEXT,
    "monthly_operation_limit" INTEGER NOT NULL DEFAULT 50,
    "daily_operation_limit" INTEGER,
    "current_month_operations" INTEGER NOT NULL DEFAULT 0,
    "current_day_operations" INTEGER NOT NULL DEFAULT 0,
    "last_daily_reset" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_monthly_reset" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "file_size_limit_mb" INTEGER NOT NULL DEFAULT 20,
    "batch_limit" INTEGER NOT NULL DEFAULT 0,
    "watermark_enabled" BOOLEAN NOT NULL DEFAULT true,
    "queue_priority" TEXT NOT NULL DEFAULT 'LOW',
    "max_seats" INTEGER NOT NULL DEFAULT 1,
    "subscription_expiry" DATETIME,
    "subscription_status" TEXT NOT NULL DEFAULT 'none',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "plan_configs" (
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
    "yearly_price_try" INTEGER NOT NULL DEFAULT 0,
    "yearly_price_usd" INTEGER NOT NULL DEFAULT 0,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
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
    "free_limit_first_exceeded_at" DATETIME,
    "total_operations_count" INTEGER NOT NULL DEFAULT 0,
    "total_throttle_events_count" INTEGER NOT NULL DEFAULT 0,
    "tool_usage_counts_json" TEXT NOT NULL DEFAULT '{}',
    "total_upgrade_cta_impressions_count" INTEGER NOT NULL DEFAULT 0,
    "organization_id" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "operation_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "tool_type" TEXT NOT NULL,
    "file_count" INTEGER NOT NULL DEFAULT 1,
    "total_file_size_mb" REAL NOT NULL DEFAULT 0,
    "is_batch" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "processing_time_ms" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "operation_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "operation_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "token" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "accepted_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaymentCheckout" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "PaymentCheckout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PaymentCheckout_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PasswordResetCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code_hash" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "consumed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    CONSTRAINT "PasswordResetCode_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usageDate" TEXT NOT NULL,
    "operationsCount" INTEGER NOT NULL DEFAULT 0,
    "post_limit_extra_ops" INTEGER NOT NULL DEFAULT 0,
    "post_limit_throttle_count" INTEGER NOT NULL DEFAULT 0,
    "lastFeatureKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "DailyUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ToolRegistry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "strategy" TEXT NOT NULL,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "is_maintenance_mode" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "discountPercent" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usageLimitPerUser" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "coupon_uses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "coupon_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "coupon_uses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "coupon_uses_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "download_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "result_id" TEXT,
    "tool_id" TEXT NOT NULL,
    "client_ip" TEXT,
    "user_agent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "acked_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "download_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PageView" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "view" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "language" TEXT,
    "referrer" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    CONSTRAINT "PageView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClientErrorLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "source" TEXT,
    "stack" TEXT,
    "url" TEXT,
    "userAgent" TEXT,
    "language" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    CONSTRAINT "ClientErrorLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DesktopDevice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceHash" TEXT NOT NULL,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blockedAt" DATETIME,
    "userId" TEXT NOT NULL,
    CONSTRAINT "DesktopDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SiteSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "site_name" TEXT NOT NULL DEFAULT 'NB PDF',
    "logo_url" TEXT,
    "global_maintenance_mode" BOOLEAN NOT NULL DEFAULT false,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "seo_keywords" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "blocked_emails" (
    "email" TEXT NOT NULL PRIMARY KEY,
    "reason" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storageKey" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT,
    "user_email" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_key" TEXT,
    "summary" TEXT NOT NULL,
    "meta_json" TEXT,
    CONSTRAINT "admin_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "setting_revisions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scope" TEXT NOT NULL,
    "user_id" TEXT,
    "user_email" TEXT NOT NULL,
    "summary" TEXT,
    "previous_json" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_stripe_customer_id_key" ON "organizations"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_stripe_subscription_id_key" ON "organizations"("stripe_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_iyzico_customer_id_key" ON "organizations"("iyzico_customer_id");

-- CreateIndex
CREATE INDEX "organizations_plan_idx" ON "organizations"("plan");

-- CreateIndex
CREATE INDEX "organizations_slug_idx" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "plan_configs_plan_key" ON "plan_configs"("plan");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE INDEX "User_organization_id_idx" ON "User"("organization_id");

-- CreateIndex
CREATE INDEX "User_country_idx" ON "User"("country");

-- CreateIndex
CREATE INDEX "operation_logs_organization_id_created_at_idx" ON "operation_logs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "operation_logs_user_id_created_at_idx" ON "operation_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "operation_logs_tool_type_idx" ON "operation_logs"("tool_type");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_key" ON "invitations"("token");

-- CreateIndex
CREATE INDEX "invitations_organization_id_idx" ON "invitations"("organization_id");

-- CreateIndex
CREATE INDEX "invitations_token_idx" ON "invitations"("token");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentCheckout_conversationId_key" ON "PaymentCheckout"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentCheckout_iyzico_token_hash_key" ON "PaymentCheckout"("iyzico_token_hash");

-- CreateIndex
CREATE INDEX "PaymentCheckout_userId_idx" ON "PaymentCheckout"("userId");

-- CreateIndex
CREATE INDEX "PaymentCheckout_organization_id_idx" ON "PaymentCheckout"("organization_id");

-- CreateIndex
CREATE INDEX "PaymentCheckout_status_idx" ON "PaymentCheckout"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetCode_user_id_idx" ON "PasswordResetCode"("user_id");

-- CreateIndex
CREATE INDEX "PasswordResetCode_expires_at_idx" ON "PasswordResetCode"("expires_at");

-- CreateIndex
CREATE INDEX "DailyUsage_userId_idx" ON "DailyUsage"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyUsage_userId_usageDate_key" ON "DailyUsage"("userId", "usageDate");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "coupon_uses_user_id_coupon_id_idx" ON "coupon_uses"("user_id", "coupon_id");

-- CreateIndex
CREATE INDEX "coupon_uses_coupon_id_idx" ON "coupon_uses"("coupon_id");

-- CreateIndex
CREATE INDEX "download_logs_user_id_created_at_idx" ON "download_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "download_logs_created_at_idx" ON "download_logs"("created_at");

-- CreateIndex
CREATE INDEX "PageView_createdAt_idx" ON "PageView"("createdAt");

-- CreateIndex
CREATE INDEX "PageView_view_idx" ON "PageView"("view");

-- CreateIndex
CREATE INDEX "PageView_userId_idx" ON "PageView"("userId");

-- CreateIndex
CREATE INDEX "ClientErrorLog_createdAt_idx" ON "ClientErrorLog"("createdAt");

-- CreateIndex
CREATE INDEX "ClientErrorLog_level_idx" ON "ClientErrorLog"("level");

-- CreateIndex
CREATE INDEX "ClientErrorLog_userId_idx" ON "ClientErrorLog"("userId");

-- CreateIndex
CREATE INDEX "DesktopDevice_userId_idx" ON "DesktopDevice"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DesktopDevice_userId_deviceHash_key" ON "DesktopDevice"("userId", "deviceHash");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_storageKey_key" ON "MediaAsset"("storageKey");

-- CreateIndex
CREATE INDEX "MediaAsset_created_at_idx" ON "MediaAsset"("created_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_created_at_idx" ON "admin_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_user_id_idx" ON "admin_audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "setting_revisions_scope_created_at_idx" ON "setting_revisions"("scope", "created_at");
