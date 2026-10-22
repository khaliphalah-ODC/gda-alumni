-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MembershipAction" AS ENUM ('SUBMITTED', 'CORRECTED', 'APPROVED', 'REJECTED', 'ACTIVATION_REISSUED', 'ACTIVATION_REVOKED', 'ACTIVATED');

-- CreateTable
CREATE TABLE "MembershipApplication" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "trackingHash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "location" TEXT,
    "previousName" TEXT,
    "graduationYear" INTEGER NOT NULL,
    "studentIndexNumber" TEXT,
    "lastClassAttended" TEXT,
    "verificationInformation" TEXT,
    "status" "MembershipStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "activationHash" TEXT,
    "activationExpiresAt" TIMESTAMP(3),
    "activationConsumedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MembershipApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipReview" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" "MembershipAction" NOT NULL,
    "notes" TEXT,
    "snapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MembershipApplication_reference_key" ON "MembershipApplication"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipApplication_activationHash_key" ON "MembershipApplication"("activationHash");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipApplication_userId_key" ON "MembershipApplication"("userId");

-- CreateIndex
CREATE INDEX "MembershipApplication_email_idx" ON "MembershipApplication"("email");

-- CreateIndex
CREATE INDEX "MembershipApplication_status_createdAt_idx" ON "MembershipApplication"("status", "createdAt");

-- CreateIndex
CREATE INDEX "MembershipReview_applicationId_createdAt_idx" ON "MembershipReview"("applicationId", "createdAt");

-- AddForeignKey
ALTER TABLE "MembershipApplication" ADD CONSTRAINT "MembershipApplication_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipApplication" ADD CONSTRAINT "MembershipApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipReview" ADD CONSTRAINT "MembershipReview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MembershipApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipReview" ADD CONSTRAINT "MembershipReview_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Permit a new application after rejection, but serialize all active applications
-- for a normalized email, including concurrent submissions.
CREATE UNIQUE INDEX "MembershipApplication_active_email_key"
ON "MembershipApplication" ("email") WHERE "status" IN ('PENDING', 'APPROVED');
