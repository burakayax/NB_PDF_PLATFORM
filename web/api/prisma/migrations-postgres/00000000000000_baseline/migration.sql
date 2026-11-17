-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'STARTER', 'PLUS', 'PRO', 'BUSINESS');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('TRY', 'USD', 'EUR');

-- CreateEnum
CREATE TYPE "QueuePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'HIGHEST');

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "OperationStatus" AS ENUM ('SUCCESS', 'FAILED', 'QUEUED');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('tr', 'en');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "DownloadLogStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "TeamSubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TeamMemberInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "TeamMemberRole" AS ENUM ('MEMBER', 'MANAGER');

-- CreateEnum
CREATE TYPE "TeamActivityStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('local', 'google');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('none', 'active', 'past_due', 'canceled', 'incomplete');

-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('X', 'LINKEDIN', 'FACEBOOK', 'INSTAGRAM', 'PINTEREST', 'YOUTUBE', 'TIKTOK');

-- CreateEnum
CREATE TYPE "SocialPostStatus" AS ENUM ('DRAFT', 'QUEUED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'SKIPPED', 'MANUAL');

-- CreateEnum
CREATE TYPE "SignatureRequestStatus" AS ENUM ('PENDING', 'VIEWED', 'SIGNED', 'DECLINED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "billing_cycle" "BillingCycle",
    "currency" "Currency" NOT NULL DEFAULT 'TRY',
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "iyzico_customer_id" TEXT,
    "monthly_operation_limit" INTEGER NOT NULL DEFAULT 50,
    "daily_operation_limit" INTEGER,
    "custom_daily_limit" INTEGER,
    "bonus_daily_operations" INTEGER NOT NULL DEFAULT 0,
    "current_month_operations" INTEGER NOT NULL DEFAULT 0,
    "current_day_operations" INTEGER NOT NULL DEFAULT 0,
    "last_daily_reset" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_monthly_reset" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "file_size_limit_mb" INTEGER NOT NULL DEFAULT 20,
    "batch_limit" INTEGER NOT NULL DEFAULT 0,
    "watermark_enabled" BOOLEAN NOT NULL DEFAULT true,
    "queue_priority" "QueuePriority" NOT NULL DEFAULT 'LOW',
    "max_seats" INTEGER NOT NULL DEFAULT 1,
    "subscription_expiry" TIMESTAMP(3),
    "subscription_status" "SubscriptionStatus" NOT NULL DEFAULT 'none',
    "base_plan" "Plan",
    "override_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_configs" (
    "id" TEXT NOT NULL,
    "plan" "Plan" NOT NULL,
    "daily_operation_limit" INTEGER,
    "monthly_operation_limit" INTEGER NOT NULL,
    "file_size_limit_mb" INTEGER NOT NULL,
    "batch_limit" INTEGER NOT NULL,
    "watermark_enabled" BOOLEAN NOT NULL,
    "queue_priority" "QueuePriority" NOT NULL,
    "allowed_tools" TEXT NOT NULL DEFAULT 'all',
    "max_seats" INTEGER NOT NULL,
    "monthly_price_try" INTEGER NOT NULL DEFAULT 0,
    "monthly_price_usd" INTEGER NOT NULL DEFAULT 0,
    "monthly_price_eur" INTEGER NOT NULL DEFAULT 0,
    "yearly_price_try" INTEGER NOT NULL DEFAULT 0,
    "yearly_price_usd" INTEGER NOT NULL DEFAULT 0,
    "yearly_price_eur" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "name" TEXT,
    "googleId" TEXT,
    "avatar" TEXT,
    "passwordHash" TEXT,
    "authProvider" "AuthProvider" NOT NULL DEFAULT 'local',
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "org_role" "OrgRole" NOT NULL DEFAULT 'OWNER',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verificationToken" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "preferredLanguage" "Language" NOT NULL DEFAULT 'en',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    "country" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "billing_address_line" TEXT,
    "billing_postal_code" TEXT,
    "billing_district" TEXT,
    "tc_kimlik_no" TEXT,
    "tax_id" TEXT,
    "tax_office" TEXT,
    "company_name" TEXT,
    "invoice_type" TEXT,
    "billing_country_code" TEXT,
    "is_kvkk_consented" BOOLEAN NOT NULL DEFAULT false,
    "kvkk_consented_at" TIMESTAMP(3),
    "marketing_consent" BOOLEAN NOT NULL DEFAULT false,
    "marketing_consent_at" TIMESTAMP(3),
    "marketing_unsubscribed_at" TIMESTAMP(3),
    "distance_sales_consented_at" TIMESTAMP(3),
    "withdrawal_waived_at" TIMESTAMP(3),
    "guardian_declared_at" TIMESTAMP(3),
    "distance_sales_version" TEXT,
    "terms_accepted_at" TIMESTAMP(3),
    "terms_version" TEXT,
    "total_refunds" INTEGER NOT NULL DEFAULT 0,
    "first_refunded_at" TIMESTAMP(3),
    "last_refunded_at" TIMESTAMP(3),
    "refund_abuse_flagged" BOOLEAN NOT NULL DEFAULT false,
    "refund_blocked_until" TIMESTAMP(3),
    "free_limit_first_exceeded_at" TIMESTAMP(3),
    "total_operations_count" INTEGER NOT NULL DEFAULT 0,
    "total_throttle_events_count" INTEGER NOT NULL DEFAULT 0,
    "tool_usage_counts_json" TEXT NOT NULL DEFAULT '{}',
    "total_upgrade_cta_impressions_count" INTEGER NOT NULL DEFAULT 0,
    "organization_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "is_team_member" BOOLEAN NOT NULL DEFAULT false,
    "team_owner_id" TEXT,
    "team_member_role" "TeamMemberRole",
    "last_login_at" TIMESTAMP(3),
    "bonus_ai_credits" INTEGER NOT NULL DEFAULT 0,
    "cv_pass_until" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operation_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "tool_type" TEXT NOT NULL,
    "file_count" INTEGER NOT NULL DEFAULT 1,
    "total_file_size_mb" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "is_batch" BOOLEAN NOT NULL DEFAULT false,
    "status" "OperationStatus" NOT NULL DEFAULT 'SUCCESS',
    "processing_time_ms" INTEGER,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'MEMBER',
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentCheckout" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "iyzico_token_hash" TEXT,
    "userId" TEXT NOT NULL,
    "organization_id" TEXT,
    "plan" "Plan" NOT NULL,
    "billing_cycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priceTry" TEXT NOT NULL,
    "payment_currency" TEXT NOT NULL DEFAULT 'TRY',
    "subscription_days" INTEGER NOT NULL DEFAULT 30,
    "coupon_id" TEXT,
    "discount_percent" INTEGER,
    "original_net_amount" TEXT,
    "extra_seats" INTEGER NOT NULL DEFAULT 0,
    "seats_only" BOOLEAN NOT NULL DEFAULT false,
    "bonus_ai_credits" INTEGER,
    "cv_pass_hours" INTEGER,
    "contract_version" TEXT,
    "distance_sales_consented_at" TIMESTAMP(3),
    "withdrawal_waived_at" TIMESTAMP(3),
    "guardian_declared_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "refunded_at" TIMESTAMP(3),
    "refund_reason" TEXT,
    "kdv_rate" DOUBLE PRECISION,
    "kdv_amount" TEXT,
    "net_amount" TEXT,
    "customer_country" TEXT,
    "invoice_status" TEXT,
    "card_country" TEXT,
    "card_bin" TEXT,
    "invoice_due_at" TIMESTAMP(3),
    "invoice_action" TEXT,
    "invoice_review_notified_at" TIMESTAMP(3),
    "iyzico_payment_id" TEXT,
    "iyzico_payment_transaction_id" TEXT,

    CONSTRAINT "PaymentCheckout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "checkout_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "external_id" TEXT,
    "invoice_no" TEXT,
    "type" TEXT NOT NULL DEFAULT 'e-arsiv',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "pdf_url" TEXT,
    "net_amount" TEXT NOT NULL,
    "kdv_rate" DOUBLE PRECISION NOT NULL,
    "kdv_amount" TEXT NOT NULL,
    "gross_amount" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "customer_name" TEXT NOT NULL,
    "customer_email" TEXT NOT NULL,
    "customer_country" TEXT NOT NULL,
    "customer_tax_id" TEXT,
    "is_export" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "credit_note_id" TEXT,
    "credit_note_status" TEXT,
    "credit_note_issued_at" TIMESTAMP(3),
    "return_status" TEXT,
    "return_requested_at" TIMESTAMP(3),
    "return_reason" TEXT,
    "return_force" BOOLEAN NOT NULL DEFAULT false,
    "return_invoice_uuid" TEXT,
    "return_invoice_no" TEXT,
    "return_kdv_amount" TEXT,
    "return_received_at" TIMESTAMP(3),
    "return_reminder_count" INTEGER NOT NULL DEFAULT 0,
    "return_last_checked_at" TIMESTAMP(3),
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_agent" TEXT,
    "ip_hash" TEXT,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "device_key" TEXT,
    "is_desktop" BOOLEAN NOT NULL DEFAULT false,
    "replaced_by_id" TEXT,
    "persistent" BOOLEAN NOT NULL DEFAULT true,
    "absolute_expires_at" TIMESTAMP(3),
    "userId" TEXT NOT NULL,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetCode" (
    "id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "PasswordResetCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyUsage" (
    "id" TEXT NOT NULL,
    "usageDate" TEXT NOT NULL,
    "operationsCount" INTEGER NOT NULL DEFAULT 0,
    "post_limit_extra_ops" INTEGER NOT NULL DEFAULT 0,
    "post_limit_throttle_count" INTEGER NOT NULL DEFAULT 0,
    "lastFeatureKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "DailyUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "operationCounts" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolRegistry" (
    "id" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "is_maintenance_mode" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolRegistry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountPercent" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usageLimitPerUser" INTEGER NOT NULL DEFAULT 1,
    "usage_limit_total" INTEGER,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_uses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "coupon_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_uses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "download_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "result_id" TEXT,
    "tool_id" TEXT NOT NULL,
    "client_ip" TEXT,
    "user_agent" TEXT,
    "status" "DownloadLogStatus" NOT NULL DEFAULT 'PENDING',
    "acked_at" TIMESTAMP(3),
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "download_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageView" (
    "id" TEXT NOT NULL,
    "view" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "language" "Language",
    "referrer" TEXT,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "PageView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_journey_events" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tool_id" TEXT,
    "extra" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT,

    CONSTRAINT "user_journey_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientErrorLog" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "source" TEXT,
    "stack" TEXT,
    "url" TEXT,
    "userAgent" TEXT,
    "language" "Language",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "ClientErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesktopDevice" (
    "id" TEXT NOT NULL,
    "deviceHash" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blockedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,

    CONSTRAINT "DesktopDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "site_name" TEXT NOT NULL DEFAULT 'PDF PLATFORM',
    "logo_url" TEXT,
    "global_maintenance_mode" BOOLEAN NOT NULL DEFAULT false,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "seo_keywords" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocked_emails" (
    "email" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocked_emails_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT,
    "user_email" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_key" TEXT,
    "summary" TEXT NOT NULL,
    "meta_json" TEXT,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setting_revisions" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scope" TEXT NOT NULL,
    "user_id" TEXT,
    "user_email" TEXT NOT NULL,
    "summary" TEXT,
    "previous_json" TEXT NOT NULL,

    CONSTRAINT "setting_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "max_seats" INTEGER NOT NULL DEFAULT 5,
    "extra_seats" INTEGER NOT NULL DEFAULT 0,
    "subscription_status" "TeamSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "subscription_ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "user_id" TEXT,
    "invite_email" TEXT NOT NULL,
    "invite_token" TEXT,
    "invite_status" "TeamMemberInviteStatus" NOT NULL DEFAULT 'PENDING',
    "role" "TeamMemberRole" NOT NULL DEFAULT 'MEMBER',
    "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joined_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_member_activities" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "tool_id" TEXT NOT NULL,
    "tool_name" TEXT NOT NULL,
    "page_count" INTEGER,
    "file_size_mb" DOUBLE PRECISION,
    "original_size_mb" DOUBLE PRECISION,
    "compressed_size_mb" DOUBLE PRECISION,
    "compression_ratio" DOUBLE PRECISION,
    "duration_ms" INTEGER,
    "status" "TeamActivityStatus" NOT NULL DEFAULT 'SUCCESS',
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_member_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_invoices" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "description" TEXT NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "triggerDays" INTEGER NOT NULL DEFAULT 3,
    "subjectTr" TEXT NOT NULL,
    "subjectEn" TEXT NOT NULL,
    "eyebrowTr" TEXT NOT NULL DEFAULT '',
    "eyebrowEn" TEXT NOT NULL DEFAULT '',
    "titleTr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "introTr" TEXT NOT NULL DEFAULT '',
    "introEn" TEXT NOT NULL DEFAULT '',
    "bodyTr" TEXT NOT NULL,
    "bodyEn" TEXT NOT NULL,
    "ctaLabelTr" TEXT NOT NULL DEFAULT '',
    "ctaLabelEn" TEXT NOT NULL DEFAULT '',
    "ctaUrl" TEXT NOT NULL DEFAULT '',
    "couponCode" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "editor_download_usage" (
    "id" TEXT NOT NULL,
    "id_key" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "editor_download_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scanned_documents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scanned_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_accounts" (
    "id" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "display_name" TEXT NOT NULL,
    "secrets_json" TEXT NOT NULL,
    "token_expires_at" TIMESTAMP(3),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_checked_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_posts" (
    "id" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "guid" TEXT NOT NULL,
    "day_key" TEXT NOT NULL,
    "lang" TEXT NOT NULL DEFAULT 'tr',
    "title" TEXT NOT NULL,
    "link_url" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "image_url" TEXT,
    "status" "SocialPostStatus" NOT NULL DEFAULT 'QUEUED',
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),
    "external_id" TEXT,
    "external_url" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "cleared_at" TIMESTAMP(3),
    "slides_json" TEXT,
    "board_key" TEXT,
    "board_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_tool_videos" (
    "id" TEXT NOT NULL,
    "tool_id" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "seconds" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_tool_videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_keyword_cache" (
    "id" TEXT NOT NULL,
    "guid" TEXT NOT NULL,
    "tr_json" TEXT NOT NULL,
    "en_json" TEXT NOT NULL,
    "tr_tags_json" TEXT,
    "en_tags_json" TEXT,
    "source" TEXT NOT NULL DEFAULT 'seo',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_keyword_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signature_requests" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "original_data" BYTEA NOT NULL,
    "original_hash" TEXT NOT NULL,
    "signed_data" BYTEA,
    "signed_hash" TEXT,
    "message" TEXT,
    "placement" TEXT,
    "notify_owner" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "status" "SignatureRequestStatus" NOT NULL DEFAULT 'PENDING',
    "signer_email" TEXT NOT NULL,
    "signer_name" TEXT,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "viewed_at" TIMESTAMP(3),
    "signed_at" TIMESTAMP(3),
    "declined_at" TIMESTAMP(3),
    "decline_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signature_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signature_events" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_hash" TEXT,
    "user_agent" TEXT,
    "detail" TEXT,
    "actor" TEXT,

    CONSTRAINT "signature_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tool_ratings" (
    "id" TEXT NOT NULL,
    "tool_slug" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "comment" TEXT,
    "voter_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tool_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_consent_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "source" TEXT NOT NULL,
    "consent_text" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_consent_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_review_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "units" INTEGER NOT NULL,
    "charge_source" TEXT NOT NULL,
    "chars" INTEGER NOT NULL,
    "doc_sha256" TEXT NOT NULL,
    "consent_version" TEXT NOT NULL,
    "consent_at" TIMESTAMP(3) NOT NULL,
    "client_ip" TEXT,
    "user_agent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "fail_reason" TEXT,
    "refunded_at" TIMESTAMP(3),
    "report_sha256" TEXT,
    "report_signature" TEXT,
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_review_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "output_records" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tool_id" TEXT NOT NULL,
    "result_id" TEXT NOT NULL,
    "file_sha256" TEXT NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "plan_at_time" TEXT,
    "produced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "output_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_request_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "op" TEXT NOT NULL,
    "units" INTEGER NOT NULL DEFAULT 1,
    "plan_at_time" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "refunded" BOOLEAN NOT NULL DEFAULT false,
    "input_sha256" TEXT,
    "output_sha256" TEXT,
    "client_ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "ai_request_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_record_archives" (
    "id" TEXT NOT NULL,
    "original_user_id" TEXT NOT NULL,
    "email_snapshot" TEXT NOT NULL,
    "name_snapshot" TEXT,
    "reason" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "retain_until" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_record_archives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_acceptance_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "via" TEXT NOT NULL DEFAULT 'email',
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_acceptance_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_health_events" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "component" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "latency_ms" INTEGER,
    "path" TEXT,
    "status" INTEGER,
    "detail" TEXT,

    CONSTRAINT "service_health_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cancellation_feedback" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "action" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cancellation_feedback_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "operation_logs_organization_id_status_created_at_idx" ON "operation_logs"("organization_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_key" ON "invitations"("token");

-- CreateIndex
CREATE INDEX "invitations_organization_id_idx" ON "invitations"("organization_id");

-- CreateIndex
CREATE INDEX "invitations_token_idx" ON "invitations"("token");

-- CreateIndex
CREATE INDEX "invitations_organization_id_expires_at_idx" ON "invitations"("organization_id", "expires_at");

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
CREATE INDEX "PaymentCheckout_userId_status_createdAt_idx" ON "PaymentCheckout"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentCheckout_invoice_status_invoice_due_at_idx" ON "PaymentCheckout"("invoice_status", "invoice_due_at");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_checkout_id_key" ON "invoices"("checkout_id");

-- CreateIndex
CREATE INDEX "invoices_user_id_idx" ON "invoices"("user_id");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_is_archived_created_at_idx" ON "invoices"("is_archived", "created_at");

-- CreateIndex
CREATE INDEX "invoices_return_status_idx" ON "invoices"("return_status");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_createdAt_idx" ON "RefreshToken"("userId", "createdAt");

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
CREATE INDEX "DailyUsage_usageDate_idx" ON "DailyUsage"("usageDate");

-- CreateIndex
CREATE INDEX "DailyUsage_userId_usageDate_operationsCount_idx" ON "DailyUsage"("userId", "usageDate", "operationsCount");

-- CreateIndex
CREATE UNIQUE INDEX "DailyUsage_userId_usageDate_key" ON "DailyUsage"("userId", "usageDate");

-- CreateIndex
CREATE INDEX "AiUsage_userId_idx" ON "AiUsage"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AiUsage_userId_yearMonth_key" ON "AiUsage"("userId", "yearMonth");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_key_hash_key" ON "ApiKey"("key_hash");

-- CreateIndex
CREATE INDEX "ApiKey_user_id_idx" ON "ApiKey"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "coupon_uses_user_id_coupon_id_idx" ON "coupon_uses"("user_id", "coupon_id");

-- CreateIndex
CREATE INDEX "coupon_uses_coupon_id_idx" ON "coupon_uses"("coupon_id");

-- CreateIndex
CREATE INDEX "coupon_uses_coupon_id_created_at_idx" ON "coupon_uses"("coupon_id", "created_at");

-- CreateIndex
CREATE INDEX "download_logs_user_id_created_at_idx" ON "download_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "download_logs_created_at_idx" ON "download_logs"("created_at");

-- CreateIndex
CREATE INDEX "download_logs_client_ip_idx" ON "download_logs"("client_ip");

-- CreateIndex
CREATE INDEX "PageView_createdAt_idx" ON "PageView"("createdAt");

-- CreateIndex
CREATE INDEX "PageView_view_idx" ON "PageView"("view");

-- CreateIndex
CREATE INDEX "PageView_userId_idx" ON "PageView"("userId");

-- CreateIndex
CREATE INDEX "PageView_sessionId_idx" ON "PageView"("sessionId");

-- CreateIndex
CREATE INDEX "user_journey_events_session_id_idx" ON "user_journey_events"("session_id");

-- CreateIndex
CREATE INDEX "user_journey_events_user_id_idx" ON "user_journey_events"("user_id");

-- CreateIndex
CREATE INDEX "user_journey_events_created_at_idx" ON "user_journey_events"("created_at");

-- CreateIndex
CREATE INDEX "user_journey_events_name_idx" ON "user_journey_events"("name");

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

-- CreateIndex
CREATE UNIQUE INDEX "teams_owner_id_key" ON "teams"("owner_id");

-- CreateIndex
CREATE INDEX "teams_owner_id_idx" ON "teams"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_user_id_key" ON "team_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_invite_token_key" ON "team_members"("invite_token");

-- CreateIndex
CREATE INDEX "team_members_team_id_idx" ON "team_members"("team_id");

-- CreateIndex
CREATE INDEX "team_members_user_id_idx" ON "team_members"("user_id");

-- CreateIndex
CREATE INDEX "team_member_activities_member_id_created_at_idx" ON "team_member_activities"("member_id", "created_at");

-- CreateIndex
CREATE INDEX "team_member_activities_tool_id_idx" ON "team_member_activities"("tool_id");

-- CreateIndex
CREATE INDEX "team_invoices_team_id_idx" ON "team_invoices"("team_id");

-- CreateIndex
CREATE INDEX "editor_download_usage_id_key_day_idx" ON "editor_download_usage"("id_key", "day");

-- CreateIndex
CREATE UNIQUE INDEX "editor_download_usage_id_key_day_key" ON "editor_download_usage"("id_key", "day");

-- CreateIndex
CREATE INDEX "scanned_documents_user_id_created_at_idx" ON "scanned_documents"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "social_accounts_platform_key" ON "social_accounts"("platform");

-- CreateIndex
CREATE INDEX "social_posts_status_scheduled_at_idx" ON "social_posts"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "social_posts_created_at_idx" ON "social_posts"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "social_posts_platform_guid_day_key_key" ON "social_posts"("platform", "guid", "day_key");

-- CreateIndex
CREATE INDEX "social_tool_videos_tool_id_created_at_idx" ON "social_tool_videos"("tool_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "social_keyword_cache_guid_key" ON "social_keyword_cache"("guid");

-- CreateIndex
CREATE UNIQUE INDEX "signature_requests_token_hash_key" ON "signature_requests"("token_hash");

-- CreateIndex
CREATE INDEX "signature_requests_owner_id_created_at_idx" ON "signature_requests"("owner_id", "created_at");

-- CreateIndex
CREATE INDEX "signature_requests_signer_email_idx" ON "signature_requests"("signer_email");

-- CreateIndex
CREATE INDEX "signature_events_request_id_at_idx" ON "signature_events"("request_id", "at");

-- CreateIndex
CREATE INDEX "tool_ratings_tool_slug_idx" ON "tool_ratings"("tool_slug");

-- CreateIndex
CREATE UNIQUE INDEX "tool_ratings_tool_slug_voter_hash_key" ON "tool_ratings"("tool_slug", "voter_hash");

-- CreateIndex
CREATE INDEX "marketing_consent_logs_user_id_created_at_idx" ON "marketing_consent_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "marketing_consent_logs_created_at_idx" ON "marketing_consent_logs"("created_at");

-- CreateIndex
CREATE INDEX "contract_review_logs_user_id_created_at_idx" ON "contract_review_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "contract_review_logs_status_created_at_idx" ON "contract_review_logs"("status", "created_at");

-- CreateIndex
CREATE INDEX "contract_review_logs_created_at_idx" ON "contract_review_logs"("created_at");

-- CreateIndex
CREATE INDEX "output_records_file_sha256_idx" ON "output_records"("file_sha256");

-- CreateIndex
CREATE INDEX "output_records_user_id_created_at_idx" ON "output_records"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "output_records_user_id_result_id_key" ON "output_records"("user_id", "result_id");

-- CreateIndex
CREATE INDEX "ai_request_logs_user_id_created_at_idx" ON "ai_request_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_request_logs_created_at_idx" ON "ai_request_logs"("created_at");

-- CreateIndex
CREATE INDEX "financial_record_archives_email_snapshot_idx" ON "financial_record_archives"("email_snapshot");

-- CreateIndex
CREATE INDEX "financial_record_archives_retain_until_idx" ON "financial_record_archives"("retain_until");

-- CreateIndex
CREATE INDEX "legal_acceptance_logs_user_id_created_at_idx" ON "legal_acceptance_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "service_health_events_component_at_idx" ON "service_health_events"("component", "at");

-- CreateIndex
CREATE INDEX "service_health_events_at_idx" ON "service_health_events"("at");

-- CreateIndex
CREATE INDEX "cancellation_feedback_created_at_idx" ON "cancellation_feedback"("created_at");

-- CreateIndex
CREATE INDEX "cancellation_feedback_user_id_idx" ON "cancellation_feedback"("user_id");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_logs" ADD CONSTRAINT "operation_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_logs" ADD CONSTRAINT "operation_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentCheckout" ADD CONSTRAINT "PaymentCheckout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentCheckout" ADD CONSTRAINT "PaymentCheckout_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_checkout_id_fkey" FOREIGN KEY ("checkout_id") REFERENCES "PaymentCheckout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetCode" ADD CONSTRAINT "PasswordResetCode_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyUsage" ADD CONSTRAINT "DailyUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_uses" ADD CONSTRAINT "coupon_uses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_uses" ADD CONSTRAINT "coupon_uses_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "download_logs" ADD CONSTRAINT "download_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageView" ADD CONSTRAINT "PageView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_journey_events" ADD CONSTRAINT "user_journey_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientErrorLog" ADD CONSTRAINT "ClientErrorLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesktopDevice" ADD CONSTRAINT "DesktopDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_member_activities" ADD CONSTRAINT "team_member_activities_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_invoices" ADD CONSTRAINT "team_invoices_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_events" ADD CONSTRAINT "signature_events_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "signature_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_review_logs" ADD CONSTRAINT "contract_review_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "output_records" ADD CONSTRAINT "output_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_request_logs" ADD CONSTRAINT "ai_request_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_acceptance_logs" ADD CONSTRAINT "legal_acceptance_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

