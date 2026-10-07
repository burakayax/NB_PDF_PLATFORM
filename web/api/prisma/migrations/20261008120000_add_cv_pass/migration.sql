-- AlterTable
ALTER TABLE "User" ADD COLUMN "cv_pass_until" DATETIME;

-- AlterTable
ALTER TABLE "PaymentCheckout" ADD COLUMN "cv_pass_hours" INTEGER;
