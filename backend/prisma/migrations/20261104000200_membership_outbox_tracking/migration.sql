-- Keep all existing IDs, references, receipt hashes and audit relationships.
ALTER TABLE "MembershipApplication" ADD COLUMN "trackingCode" TEXT;
ALTER TABLE "MembershipApplication" ADD COLUMN "activationDeliveryError" TEXT;
CREATE UNIQUE INDEX "MembershipApplication_trackingCode_key" ON "MembershipApplication"("trackingCode");
-- gen_random_uuid is built into PostgreSQL 13+; no extension is installed.
-- Retry a collision per row, without changing any historical reference.
DO $$
DECLARE application RECORD; candidate TEXT;
BEGIN
  FOR application IN SELECT "id" FROM "MembershipApplication" WHERE "trackingCode" IS NULL LOOP
    LOOP
      candidate := (100000000000::bigint + ('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))::bit(48)::bigint % 900000000000::bigint)::text;
      BEGIN
        UPDATE "MembershipApplication" SET "trackingCode" = candidate WHERE "id" = application."id";
        EXIT;
      EXCEPTION WHEN unique_violation THEN NULL;
      END;
    END LOOP;
  END LOOP;
END $$;
ALTER TABLE "MembershipApplication" ALTER COLUMN "trackingCode" SET NOT NULL;
ALTER TABLE "MembershipApplication" ALTER COLUMN "trackingCode" SET DEFAULT ((100000000000::bigint + (('x'::text || substr(replace(gen_random_uuid()::text, '-'::text, ''::text), 1, 12))::bit(48))::bigint % 900000000000::bigint))::text;
ALTER TABLE "MembershipApplication" ADD CONSTRAINT "MembershipApplication_trackingCode_digits" CHECK ("trackingCode" ~ '^[0-9]{12}$');

CREATE TABLE "MembershipInvitation" (
  "id" TEXT NOT NULL PRIMARY KEY, "applicationId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
  "status" "ActivationDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
  "attempts" INTEGER NOT NULL DEFAULT 0, "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseId" TEXT, "leasedAt" TIMESTAMP(3), "lastError" TEXT, "provider" TEXT,
  "acceptedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MembershipInvitation_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MembershipApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MembershipInvitation_tokenHash_key" ON "MembershipInvitation"("tokenHash");
CREATE INDEX "MembershipInvitation_status_availableAt_idx" ON "MembershipInvitation"("status", "availableAt");

CREATE TABLE "MembershipTrackingChallenge" (
  "id" TEXT NOT NULL PRIMARY KEY, "applicationId" TEXT NOT NULL, "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL, "attempts" INTEGER NOT NULL DEFAULT 0,
  "deliveredAt" TIMESTAMP(3), "consumedAt" TIMESTAMP(3), "proofHash" TEXT, "proofExpiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MembershipTrackingChallenge_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MembershipApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MembershipTrackingChallenge_proofHash_key" ON "MembershipTrackingChallenge"("proofHash");
CREATE INDEX "MembershipTrackingChallenge_applicationId_createdAt_idx" ON "MembershipTrackingChallenge"("applicationId", "createdAt");
