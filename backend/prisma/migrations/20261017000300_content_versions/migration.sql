-- Preserve all posts; version guards editing and moderation races.
ALTER TABLE "Post" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
