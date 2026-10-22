CREATE TABLE "ChatbotSettings" (
 "id" INTEGER NOT NULL DEFAULT 1, "enabled" BOOLEAN NOT NULL DEFAULT false,
 "model" TEXT NOT NULL DEFAULT 'openai/gpt-oss-20b', "dailyRequests" INTEGER NOT NULL DEFAULT 100,
 "dailyBudgetMicros" INTEGER NOT NULL DEFAULT 1000000, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ChatbotSettings_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ChatbotSettings_limits" CHECK ("dailyRequests" BETWEEN 1 AND 10000 AND "dailyBudgetMicros" BETWEEN 1000 AND 100000000)
);
CREATE TABLE "ChatbotFaq" (
 "id" TEXT NOT NULL, "question" TEXT NOT NULL, "answer" TEXT NOT NULL, "path" TEXT NOT NULL,
 "published" BOOLEAN NOT NULL DEFAULT false, "validUntil" TIMESTAMP(3) NOT NULL,
 "version" INTEGER NOT NULL DEFAULT 0, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ChatbotFaq_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ChatbotUsage" (
 "day" TEXT NOT NULL, "requests" INTEGER NOT NULL DEFAULT 0, "reservedMicros" INTEGER NOT NULL DEFAULT 0,
 CONSTRAINT "ChatbotUsage_pkey" PRIMARY KEY ("day")
);
