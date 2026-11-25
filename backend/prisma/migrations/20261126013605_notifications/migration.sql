-- Notifications feature (docs/features/notifications.md, section c): the updates on each
-- user's Notifications screen. Only adds things; no existing table, column or row changes.

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('requestApproved', 'requestDeclined', 'inviteAccepted', 'inviteDeclined', 'memberRemoved', 'memberLeft', 'becameCaptain', 'teamDeleted', 'teamDeletedInvite', 'teamDeletedRequest', 'venueApproved', 'venueMovedToReview');

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" "NotificationType" NOT NULL,
    "teamId" INTEGER,
    "teamName" TEXT,
    "playerId" INTEGER,
    "playerName" TEXT,
    "venueName" TEXT,
    "note" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_id_idx" ON "Notification"("userId", "id");

-- CreateIndex
CREATE INDEX "Notification_playerId_idx" ON "Notification"("playerId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

