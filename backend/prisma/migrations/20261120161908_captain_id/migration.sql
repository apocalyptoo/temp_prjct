-- Task 4.1: the captain is stored only in Team.captainId (DECISIONS.md 2026-11-18).
-- Hand-edited: Prisma generated "drop ownerId, add captainId", which would have
-- wiped every team's captain. This renames the column in place instead.

-- Safety check: stop (and change nothing) unless every team's captain has an
-- accepted 'captain' member row and no other row is marked 'captain'. Only then
-- is TeamMember.role fully covered by captainId and safe to drop.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Team" t
    WHERE NOT EXISTS (
      SELECT 1 FROM "TeamMember" m
      WHERE m."teamId" = t."id" AND m."userId" = t."ownerId"
        AND m."status" = 'accepted' AND m."role" = 'captain'
    )
  ) OR EXISTS (
    SELECT 1 FROM "TeamMember" m JOIN "Team" t ON t."id" = m."teamId"
    WHERE m."role" = 'captain' AND m."userId" <> t."ownerId"
  ) THEN
    RAISE EXCEPTION 'captain_id: Team.ownerId and TeamMember captain rows disagree; fix the data first';
  END IF;
END $$;

-- Rename the column in place: every value (every team's captain) is kept.
ALTER TABLE "Team" RENAME COLUMN "ownerId" TO "captainId";

-- Rename the foreign key to the name Prisma expects, so later migrations stay clean.
ALTER TABLE "Team" RENAME CONSTRAINT "Team_ownerId_fkey" TO "Team_captainId_fkey";

-- New index: teams are looked up by their captain (my teams, deleting a user).
CREATE INDEX "Team_captainId_idx" ON "Team"("captainId");

-- The captain is no longer marked on their member row.
ALTER TABLE "TeamMember" DROP COLUMN "role";
