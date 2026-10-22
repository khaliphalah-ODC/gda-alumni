-- Add delivery diagnostics without storing invitation tokens or changing approval records.
CREATE TYPE "ActivationDeliveryStatus" AS ENUM ('NONE', 'DEVELOPMENT', 'SENT', 'FAILED');
ALTER TABLE "MembershipApplication" ADD COLUMN "activationDeliveryStatus" "ActivationDeliveryStatus" NOT NULL DEFAULT 'NONE', ADD COLUMN "activationDeliveryAt" TIMESTAMP(3);
