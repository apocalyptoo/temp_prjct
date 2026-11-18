-- Hash verification and reset tokens, add a verification link expiry, index the token columns.
-- Additive only: no columns or rows are removed.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "verifyTokenExpires" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "User_verifyToken_idx" ON "User"("verifyToken");

-- CreateIndex
CREATE INDEX "User_resetToken_idx" ON "User"("resetToken");

-- Data: existing tokens are plain text. Store their SHA-256 hash instead, written as
-- lowercase hex, exactly like hashToken() in src/utils/tokens.js, so links already
-- sent by email keep working.
UPDATE "User"
SET "verifyToken" = encode(sha256(convert_to("verifyToken", 'UTF8')), 'hex')
WHERE "verifyToken" IS NOT NULL;

UPDATE "User"
SET "resetToken" = encode(sha256(convert_to("resetToken", 'UTF8')), 'hex')
WHERE "resetToken" IS NOT NULL;

-- Data: unverified accounts that already have a verification link get 24 hours from now.
UPDATE "User"
SET "verifyTokenExpires" = NOW() + INTERVAL '24 hours'
WHERE "verifyToken" IS NOT NULL AND "verified" = false;
