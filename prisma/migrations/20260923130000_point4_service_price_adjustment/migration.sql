ALTER TABLE "appointment_services"
ADD COLUMN "basePriceSnapshot" DECIMAL(10,2),
ADD COLUMN "priceAdjustmentReason" VARCHAR(500),
ADD COLUMN "priceReviewedAt" TIMESTAMP(3);

UPDATE "appointment_services"
SET "basePriceSnapshot" = "price"
WHERE "basePriceSnapshot" IS NULL;
