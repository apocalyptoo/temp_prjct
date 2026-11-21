-- Feature 2: profiles and registration (docs/features/profiles-and-registration.md,
-- section c; DECISIONS.md 2026-11-20 "Shorter registration" and "Position is a fixed
-- list", 2026-11-22 "Profiles and registration details").
-- Hand-edited: Prisma generated "drop address and position, add area and a new
-- position", which would have lost every player's position and address. This converts
-- and renames in place. Postgres runs the whole file as one unit: if any line fails,
-- nothing changes.

-- 1. The list of positions, spelled exactly as the app shows them (spec P1).
CREATE TYPE "Position" AS ENUM ('Goalkeeper', 'Defender', 'Midfielder', 'Forward', 'Any');

-- 2. position: convert the free text to the list in place (PRODUCT.md, "Registration").
--    Obvious matches, ignoring upper/lower case and spaces at both ends, map to their
--    value (spec P2); everything else becomes Any. Mapping shown to and approved by the
--    owner on 2026-11-22: Mid -> Midfielder, ATT and att -> Forward, gk -> Goalkeeper;
--    Any, Forward, Goalkeeper and Defender stay as they are.
ALTER TABLE "PlayerProfile" ALTER COLUMN "position" TYPE "Position" USING (
  CASE lower(btrim("position"))
    WHEN 'goalkeeper' THEN 'Goalkeeper'
    WHEN 'keeper'     THEN 'Goalkeeper'
    WHEN 'goalie'     THEN 'Goalkeeper'
    WHEN 'gk'         THEN 'Goalkeeper'
    WHEN 'defender'   THEN 'Defender'
    WHEN 'defence'    THEN 'Defender'
    WHEN 'defense'    THEN 'Defender'
    WHEN 'def'        THEN 'Defender'
    WHEN 'back'       THEN 'Defender'
    WHEN 'cb'         THEN 'Defender'
    WHEN 'fixo'       THEN 'Defender'
    WHEN 'midfielder' THEN 'Midfielder'
    WHEN 'midfield'   THEN 'Midfielder'
    WHEN 'mid'        THEN 'Midfielder'
    WHEN 'cm'         THEN 'Midfielder'
    WHEN 'ala'        THEN 'Midfielder'
    WHEN 'winger'     THEN 'Midfielder'
    WHEN 'forward'    THEN 'Forward'
    WHEN 'fwd'        THEN 'Forward'
    WHEN 'striker'    THEN 'Forward'
    WHEN 'st'         THEN 'Forward'
    WHEN 'att'        THEN 'Forward'
    WHEN 'attack'     THEN 'Forward'
    WHEN 'attacker'   THEN 'Forward'
    WHEN 'pivot'      THEN 'Forward'
    ELSE 'Any'
  END
)::"Position";

-- 3. address becomes area, in place, so any value is kept (PRODUCT.md, "Profile
--    visibility"). On 2026-11-22 no player had an address.
ALTER TABLE "PlayerProfile" RENAME COLUMN "address" TO "area";

-- 4. The venue's phone and address are optional since the short owner sign-up.
ALTER TABLE "OwnerProfile" ALTER COLUMN "phone" DROP NOT NULL;
ALTER TABLE "OwnerProfile" ALTER COLUMN "address" DROP NOT NULL;

-- 5. When the user agreed to the Terms of Use and Privacy Policy. Existing accounts
--    stay null: they registered before the checkbox existed (spec P7).
ALTER TABLE "User" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
