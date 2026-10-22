-- Additive only. Historical StudentProfile records and enum remain untouched.
ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Request" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
