CREATE TABLE "subscription_dues" (
  "id" UUID NOT NULL,
  "salonId" UUID NOT NULL,
  "title" VARCHAR(150) NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "paymentId" UUID,
  "processedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "note" VARCHAR(500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subscription_dues_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "subscription_dues_positive_amount" CHECK ("amount" > 0),
  CONSTRAINT "subscription_dues_state" CHECK (("paymentId" IS NULL) = ("processedAt" IS NULL) AND NOT ("paymentId" IS NOT NULL AND "cancelledAt" IS NOT NULL))
);
CREATE UNIQUE INDEX "subscription_dues_paymentId_key" ON "subscription_dues"("paymentId");
CREATE UNIQUE INDEX "subscription_dues_salonId_dueAt_title_key" ON "subscription_dues"("salonId", "dueAt", "title");
CREATE INDEX "subscription_dues_dueAt_salonId_idx" ON "subscription_dues"("dueAt", "salonId");
ALTER TABLE "subscription_dues" ADD CONSTRAINT "subscription_dues_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscription_dues" ADD CONSTRAINT "subscription_dues_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "subscription_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
