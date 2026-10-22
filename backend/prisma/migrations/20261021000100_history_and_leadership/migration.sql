-- Reuse the publication/version/media lifecycle without changing existing records.
ALTER TYPE "PostType" ADD VALUE 'HISTORY';
ALTER TYPE "PostType" ADD VALUE 'SCHOOL_LEADER';
ALTER TYPE "PostType" ADD VALUE 'ALUMNI_LEADER';

ALTER TABLE "Post"
  ADD COLUMN "milestoneDate" TEXT,
  ADD COLUMN "position" TEXT,
  ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Post_type_isPublished_displayOrder_idx" ON "Post"("type", "isPublished", "displayOrder");
