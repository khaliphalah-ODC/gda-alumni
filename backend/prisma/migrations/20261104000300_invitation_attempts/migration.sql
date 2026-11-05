CREATE TABLE "MembershipInvitationAttempt" (
  "id" TEXT NOT NULL PRIMARY KEY, "invitationId" TEXT NOT NULL, "number" INTEGER NOT NULL,
  "status" "ActivationDeliveryStatus" NOT NULL DEFAULT 'SENDING',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" TIMESTAMP(3), "diagnostic" TEXT,
  CONSTRAINT "MembershipInvitationAttempt_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "MembershipInvitation"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MembershipInvitationAttempt_invitationId_number_key" ON "MembershipInvitationAttempt"("invitationId", "number");
