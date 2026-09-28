-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

-- CreateEnum
CREATE TYPE "IncidentPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SalonLifecycle" AS ENUM ('PREPARING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMIN';

-- AlterTable
ALTER TABLE "salons" ADD COLUMN     "currency" VARCHAR(3) NOT NULL DEFAULT 'MAD',
ADD COLUMN     "lifecycle" "SalonLifecycle" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Africa/Casablanca';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "authVersion" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "salonId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "salon_subscriptions" (
    "id" UUID NOT NULL,
    "salonId" UUID NOT NULL,
    "planName" TEXT NOT NULL DEFAULT 'Pilote',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "monthlyPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'MAD',
    "periodEnd" TIMESTAMP(3),
    "note" VARCHAR(1000),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salon_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_incidents" (
    "id" UUID NOT NULL,
    "salonId" UUID,
    "title" VARCHAR(150) NOT NULL,
    "description" VARCHAR(3000) NOT NULL,
    "priority" "IncidentPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" VARCHAR(3000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reportedById" UUID,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "platform_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_audit_logs" (
    "id" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "salonId" UUID,
    "action" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_payments" (
    "id" UUID NOT NULL,
    "salonId" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "method" VARCHAR(40) NOT NULL,
    "reference" VARCHAR(150),
    "recordedById" UUID NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidReason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_incident_messages" (
    "id" UUID NOT NULL,
    "incidentId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "body" VARCHAR(3000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_incident_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_throttles" (
    "key" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "login_throttles_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "salon_subscriptions_salonId_key" ON "salon_subscriptions"("salonId");

-- CreateIndex
CREATE INDEX "platform_incidents_status_createdAt_idx" ON "platform_incidents"("status", "createdAt");

-- CreateIndex
CREATE INDEX "platform_incidents_salonId_idx" ON "platform_incidents"("salonId");

-- CreateIndex
CREATE INDEX "platform_audit_logs_createdAt_idx" ON "platform_audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "platform_audit_logs_salonId_createdAt_idx" ON "platform_audit_logs"("salonId", "createdAt");

-- CreateIndex
CREATE INDEX "subscription_payments_salonId_paidAt_idx" ON "subscription_payments"("salonId", "paidAt");

-- CreateIndex
CREATE INDEX "platform_incident_messages_incidentId_createdAt_idx" ON "platform_incident_messages"("incidentId", "createdAt");

-- CreateIndex
CREATE INDEX "login_throttles_expiresAt_idx" ON "login_throttles"("expiresAt");

-- AddForeignKey
ALTER TABLE "salon_subscriptions" ADD CONSTRAINT "salon_subscriptions_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_incidents" ADD CONSTRAINT "platform_incidents_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_audit_logs" ADD CONSTRAINT "platform_audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_audit_logs" ADD CONSTRAINT "platform_audit_logs_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_incident_messages" ADD CONSTRAINT "platform_incident_messages_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "platform_incidents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Preserve the state of salons that were already suspended before this migration.
UPDATE "salons" SET "lifecycle" = 'SUSPENDED' WHERE "isActive" = false;
ALTER TABLE "users" ADD CONSTRAINT "users_role_scope_check"
CHECK (("role"::text = 'SUPER_ADMIN' AND "salonId" IS NULL AND "canManageSalon" = false)
 OR ("role"::text <> 'SUPER_ADMIN' AND "salonId" IS NOT NULL));
CREATE UNIQUE INDEX "users_platform_email_key" ON "users" (lower("email")) WHERE "salonId" IS NULL;
ALTER TABLE "salon_subscriptions" ADD CONSTRAINT "subscription_price_nonnegative" CHECK ("monthlyPrice" >= 0);
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payment_valid" CHECK ("amount" > 0 AND "periodEnd" >= "periodStart");
