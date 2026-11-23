-- Explore feature (docs/features/explore.md, section c): an optional area on teams,
-- set by the captain on the team form. Existing teams start without one (null).
-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "area" TEXT;
