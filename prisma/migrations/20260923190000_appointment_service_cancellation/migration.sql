ALTER TABLE "appointment_services"
ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "cancelledByUserId" UUID,
ADD COLUMN "cancellationReason" VARCHAR(500);

CREATE INDEX "appointment_services_cancelledAt_idx"
ON "appointment_services"("cancelledAt");
