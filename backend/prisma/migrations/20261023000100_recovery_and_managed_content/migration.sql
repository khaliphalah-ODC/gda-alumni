ALTER TYPE "PostType" ADD VALUE IF NOT EXISTS 'GALLERY';
ALTER TYPE "PostType" ADD VALUE IF NOT EXISTS 'ACHIEVEMENT';
ALTER TABLE "Post" ADD COLUMN "category" TEXT, ADD COLUMN "imageAlt" TEXT, ADD COLUMN "imageCaption" TEXT,
  ADD COLUMN "imageWidth" INTEGER, ADD COLUMN "imageHeight" INTEGER,
  ADD COLUMN "summary" TEXT, ADD COLUMN "heading" TEXT, ADD COLUMN "sourceUrl" TEXT,
  ADD COLUMN "sourceLabel" TEXT, ADD COLUMN "legacyKey" TEXT;
CREATE UNIQUE INDEX "Post_legacyKey_key" ON "Post"("legacyKey");
CREATE INDEX "Post_type_isPublished_category_idx" ON "Post"("type", "isPublished", "category");
ALTER TABLE "PlatformSettings" ADD COLUMN "galleryManaged" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "achievementsManaged" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AccountToken" ADD COLUMN "sessionVersion" INTEGER, ADD COLUMN "emailSnapshot" TEXT;
ALTER TABLE "MediaCleanup" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "leaseUntil" TIMESTAMP(3), ADD COLUMN "leaseToken" TEXT;
CREATE INDEX "MediaCleanup_nextAttemptAt_idx" ON "MediaCleanup"("nextAttemptAt");
CREATE TABLE "RateLimitBucket" ("key" TEXT NOT NULL, "count" INTEGER NOT NULL,
  "resetAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key"));
CREATE INDEX "RateLimitBucket_resetAt_idx" ON "RateLimitBucket"("resetAt");
