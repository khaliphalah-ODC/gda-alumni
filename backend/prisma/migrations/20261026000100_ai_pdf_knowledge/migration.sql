-- CreateEnum
CREATE TYPE "KnowledgeProcessingStatus" AS ENUM ('PROCESSING', 'READY', 'NEEDS_REVIEW', 'OCR_REQUIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "KnowledgeApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ARCHIVED', 'SUPERSEDED');

-- AlterTable
ALTER TABLE "ChatbotSettings" ADD COLUMN     "outputTokenLimit" INTEGER NOT NULL DEFAULT 1024;

-- CreateTable
CREATE TABLE "AiKnowledgeDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "originalBytes" BYTEA NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "fileHash" TEXT NOT NULL,
    "processingStatus" "KnowledgeProcessingStatus" NOT NULL DEFAULT 'PROCESSING',
    "approvalStatus" "KnowledgeApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "securityReviewed" BOOLEAN NOT NULL DEFAULT false,
    "publicOriginal" BOOLEAN NOT NULL DEFAULT false,
    "processingError" TEXT,
    "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "emptyPages" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "edition" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 0,
    "supersedesId" TEXT,
    "supersedesVersion" INTEGER,
    "uploadedBy" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiKnowledgeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiKnowledgeChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "ordering" INTEGER NOT NULL,
    "edition" INTEGER NOT NULL,

    CONSTRAINT "AiKnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiKnowledgeDocument_supersedesId_key" ON "AiKnowledgeDocument"("supersedesId");

-- CreateIndex
CREATE INDEX "AiKnowledgeDocument_approvalStatus_processingStatus_idx" ON "AiKnowledgeDocument"("approvalStatus", "processingStatus");

-- CreateIndex
CREATE INDEX "AiKnowledgeDocument_category_createdAt_idx" ON "AiKnowledgeDocument"("category", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiKnowledgeChunk_documentId_ordering_key" ON "AiKnowledgeChunk"("documentId", "ordering");

-- AddForeignKey
ALTER TABLE "AiKnowledgeDocument" ADD CONSTRAINT "AiKnowledgeDocument_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "AiKnowledgeDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiKnowledgeDocument" ADD CONSTRAINT "AiKnowledgeDocument_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiKnowledgeDocument" ADD CONSTRAINT "AiKnowledgeDocument_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiKnowledgeChunk" ADD CONSTRAINT "AiKnowledgeChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "AiKnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Expression indexes keep public retrieval bounded without loading whole documents.
CREATE INDEX "AiKnowledgeChunk_search_idx" ON "AiKnowledgeChunk" USING GIN (to_tsvector('english', "text"));
CREATE INDEX "ChatbotFaq_search_idx" ON "ChatbotFaq" USING GIN (to_tsvector('english', "question" || ' ' || "answer"));
