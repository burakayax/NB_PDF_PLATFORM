-- AlterTable
ALTER TABLE "PaymentCheckout" ADD COLUMN "customer_country" TEXT;
ALTER TABLE "PaymentCheckout" ADD COLUMN "invoice_status" TEXT;
ALTER TABLE "PaymentCheckout" ADD COLUMN "kdv_amount" TEXT;
ALTER TABLE "PaymentCheckout" ADD COLUMN "kdv_rate" REAL;
ALTER TABLE "PaymentCheckout" ADD COLUMN "net_amount" TEXT;
ALTER TABLE "PaymentCheckout" ADD COLUMN "refund_reason" TEXT;
ALTER TABLE "PaymentCheckout" ADD COLUMN "refunded_at" DATETIME;

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "checkout_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "external_id" TEXT,
    "invoice_no" TEXT,
    "type" TEXT NOT NULL DEFAULT 'e-arsiv',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "pdf_url" TEXT,
    "net_amount" TEXT NOT NULL,
    "kdv_rate" REAL NOT NULL,
    "kdv_amount" TEXT NOT NULL,
    "gross_amount" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "customer_name" TEXT NOT NULL,
    "customer_email" TEXT NOT NULL,
    "customer_country" TEXT NOT NULL,
    "customer_tax_id" TEXT,
    "is_export" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" DATETIME,
    CONSTRAINT "invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "invoices_checkout_id_fkey" FOREIGN KEY ("checkout_id") REFERENCES "PaymentCheckout" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "max_seats" INTEGER NOT NULL DEFAULT 5,
    "extra_seats" INTEGER NOT NULL DEFAULT 0,
    "subscription_status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "subscription_ends_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "teams_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "team_id" TEXT NOT NULL,
    "user_id" TEXT,
    "invite_email" TEXT NOT NULL,
    "invite_token" TEXT,
    "invite_status" TEXT NOT NULL DEFAULT 'PENDING',
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "invited_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joined_at" DATETIME,
    "revoked_at" DATETIME,
    CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "team_member_activities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "member_id" TEXT NOT NULL,
    "tool_id" TEXT NOT NULL,
    "tool_name" TEXT NOT NULL,
    "page_count" INTEGER,
    "file_size_mb" REAL,
    "original_size_mb" REAL,
    "compressed_size_mb" REAL,
    "compression_ratio" REAL,
    "duration_ms" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "ip_address" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "team_member_activities_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "team_members" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "team_invoices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "team_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "description" TEXT NOT NULL,
    "paid_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "team_invoices_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    CONSTRAINT "User_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("authProvider", "avatar", "billing_address_line", "billing_postal_code", "city", "country", "createdAt", "email", "first_name", "free_limit_first_exceeded_at", "googleId", "id", "isVerified", "last_name", "name", "org_role", "organization_id", "passwordHash", "phone", "plan", "preferredLanguage", "role", "timezone", "tool_usage_counts_json", "total_operations_count", "total_throttle_events_count", "total_upgrade_cta_impressions_count", "updatedAt", "verificationToken", "verifiedAt") SELECT "authProvider", "avatar", "billing_address_line", "billing_postal_code", "city", "country", "createdAt", "email", "first_name", "free_limit_first_exceeded_at", "googleId", "id", "isVerified", "last_name", "name", "org_role", "organization_id", "passwordHash", "phone", "plan", "preferredLanguage", "role", "timezone", "tool_usage_counts_json", "total_operations_count", "total_throttle_events_count", "total_upgrade_cta_impressions_count", "updatedAt", "verificationToken", "verifiedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
CREATE INDEX "User_organization_id_idx" ON "User"("organization_id");
CREATE INDEX "User_country_idx" ON "User"("country");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "invoices_checkout_id_key" ON "invoices"("checkout_id");

-- CreateIndex
CREATE INDEX "invoices_user_id_idx" ON "invoices"("user_id");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

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
