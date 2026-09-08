-- Phase auth A+B: permettre un login par téléphone ou email sans casser les comptes existants.
ALTER TABLE "users" ADD COLUMN "phone" TEXT;
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;

CREATE UNIQUE INDEX "users_salonId_phone_key" ON "users"("salonId", "phone");
