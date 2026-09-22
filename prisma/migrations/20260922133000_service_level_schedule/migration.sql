-- Chaque prestation possède désormais son propre créneau.
ALTER TABLE "appointment_services" ADD COLUMN "scheduledStart" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- Compatibilité des rendez-vous existants : ils démarrent initialement à l'heure du RDV.
UPDATE "appointment_services" AS s
SET "scheduledStart" = a."scheduledStart"
FROM "appointments" AS a
WHERE s."appointmentId" = a."id";

ALTER TABLE "appointment_services" ALTER COLUMN "scheduledStart" SET NOT NULL;
CREATE INDEX "appointment_services_scheduledStart_idx" ON "appointment_services"("scheduledStart");
