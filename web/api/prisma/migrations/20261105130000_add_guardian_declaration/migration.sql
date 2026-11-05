-- AlterTable
ALTER TABLE "User" ADD COLUMN "guardian_declared_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PaymentCheckout" ADD COLUMN "guardian_declared_at" TIMESTAMP(3);
