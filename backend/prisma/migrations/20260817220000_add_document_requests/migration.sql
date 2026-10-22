
-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('CERTIFICATE', 'TRANSCRIPT', 'DIPLOMA', 'WAEC_CERTIFICATE', 'WASSCE_CERTIFICATE');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'READY_FOR_PICKUP', 'COMPLETED');

-- CreateTable
CREATE TABLE "Request" (
    "id" TEXT NOT NULL,
    "requestType" "RequestType" NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "adminNote" TEXT,
    "requestedBy" TEXT NOT NULL,
    "fullNameAtGraduation" TEXT NOT NULL,
    "graduationYear" INTEGER,
    "studentIdOrIndexNumber" TEXT,
    "contactPhone" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Request_requestedBy_idx" ON "Request"("requestedBy");

-- CreateIndex
CREATE INDEX "Request_status_idx" ON "Request"("status");

-- CreateIndex
CREATE INDEX "Request_requestType_idx" ON "Request"("requestType");

-- CreateIndex
CREATE INDEX "Request_createdAt_idx" ON "Request"("createdAt");

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
