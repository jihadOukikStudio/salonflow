-- AlterTable
ALTER TABLE "services" ADD COLUMN     "isStartingPrice" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "defaultDurationMinutes" DROP NOT NULL;
