-- AlterTable
-- Agregar campos adicionales para customers/viajeros (opcionales)
ALTER TABLE "user" ADD COLUMN "bio" STRING;
ALTER TABLE "user" ADD COLUMN "preferences" STRING;
ALTER TABLE "user" ADD COLUMN "travel_styles" STRING;
ALTER TABLE "user" ADD COLUMN "interest_tags" STRING;
ALTER TABLE "user" ADD COLUMN "notify_email" BOOLEAN DEFAULT true;
ALTER TABLE "user" ADD COLUMN "notify_sms" BOOLEAN DEFAULT false;
