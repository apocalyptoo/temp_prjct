-- Task 4.2: membership data (DECISIONS.md 2026-11-17, 2026-11-18 "accepted at",
-- 2026-11-20 "Phase 4 order").
-- Hand-edited: Prisma generated "drop status and joinedAt, add new columns", which
-- would have lost every row's status and date. This converts and renames in place.
-- Postgres runs the whole file as one unit: if any line fails, nothing changes.

-- 1. Safety check: stop (and change nothing) if any status is something other than
--    'pending' or 'accepted', or if any team's captain lacks an accepted member row.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "TeamMember" WHERE "status" NOT IN ('pending', 'accepted')) THEN
    RAISE EXCEPTION 'membership_data: TeamMember.status has a value other than pending or accepted; fix the data first';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "Team" t
    WHERE NOT EXISTS (
      SELECT 1 FROM "TeamMember" m
      WHERE m."teamId" = t."id" AND m."userId" = t."captainId" AND m."status" = 'accepted'
    )
  ) THEN
    RAISE EXCEPTION 'membership_data: a team captain has no accepted member row; fix the data first';
  END IF;
END $$;

-- 2. Owner's decision (2026-11-20, Task 4.2 data check): delete one accepted row made
--    before the /join bypass was closed (commit f8114d3, 2026-11-18 08:28:24 UTC). It may
--    be a self-made join, and old invites and joins can't be told apart. Every condition
--    must match, so on any other database this deletes nothing.
DELETE FROM "TeamMember"
WHERE "id" = 33 AND "teamId" = 22 AND "userId" = 5
  AND "joinedAt" < TIMESTAMP '2026-11-18 08:28:24';

-- 3. The two new lists of allowed values.
CREATE TYPE "MembershipStatus" AS ENUM ('pending', 'accepted');
CREATE TYPE "MembershipOrigin" AS ENUM ('invite', 'request', 'creator');

-- 4. status: convert the text column to the enum in place. The old text default can't
--    be converted automatically, so it's removed first and put back afterwards.
ALTER TABLE "TeamMember" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "TeamMember" ALTER COLUMN "status" TYPE "MembershipStatus" USING ("status"::"MembershipStatus");
ALTER TABLE "TeamMember" ALTER COLUMN "status" SET DEFAULT 'pending';

-- 5. joinedAt is really when the invite, request or team was created: rename in place.
ALTER TABLE "TeamMember" RENAME COLUMN "joinedAt" TO "createdAt";

-- 6. origin: add it empty, fill it, then make it required. The captain's own row is
--    'creator'; every other row is 'invite' (only invites have been possible since
--    the /join route was removed).
ALTER TABLE "TeamMember" ADD COLUMN "origin" "MembershipOrigin";
UPDATE "TeamMember" m
SET "origin" = CASE WHEN m."userId" = t."captainId" THEN 'creator'::"MembershipOrigin"
                    ELSE 'invite'::"MembershipOrigin" END
FROM "Team" t
WHERE t."id" = m."teamId";
ALTER TABLE "TeamMember" ALTER COLUMN "origin" SET NOT NULL;

-- 7. acceptedAt: the best value available for existing accepted rows is the old
--    joinedAt (DECISIONS.md 2026-11-18). Pending rows stay empty.
ALTER TABLE "TeamMember" ADD COLUMN "acceptedAt" TIMESTAMP(3);
UPDATE "TeamMember" SET "acceptedAt" = "createdAt" WHERE "status" = 'accepted';

-- 8. Cascade as a safety net: profiles go with their user; membership rows go with
--    their team and with their user. A foreign key's delete rule can't be changed in
--    place, so each one is dropped and re-added with the same name.
--    Team_captainId_fkey stays RESTRICT (unchanged): a captain can't be deleted.
ALTER TABLE "PlayerProfile" DROP CONSTRAINT "PlayerProfile_userId_fkey";
ALTER TABLE "PlayerProfile" ADD CONSTRAINT "PlayerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OwnerProfile" DROP CONSTRAINT "OwnerProfile_userId_fkey";
ALTER TABLE "OwnerProfile" ADD CONSTRAINT "OwnerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeamMember" DROP CONSTRAINT "TeamMember_teamId_fkey";
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeamMember" DROP CONSTRAINT "TeamMember_userId_fkey";
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 9. Index for "my teams" and "my invites" lookups (by user and status).
CREATE INDEX "TeamMember_userId_status_idx" ON "TeamMember"("userId", "status");
