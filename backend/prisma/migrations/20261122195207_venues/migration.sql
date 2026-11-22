-- Venues feature (docs/features/venues.md, section c): the rest of the venue listing,
-- admin review and the admin's note. Every new column is optional.
-- AlterTable
ALTER TABLE "OwnerProfile" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "area" TEXT,
ADD COLUMN     "openingHours" TEXT,
ADD COLUMN     "pricingInfo" TEXT,
ADD COLUMN     "reviewNote" TEXT;

-- CreateIndex
CREATE INDEX "OwnerProfile_approvedAt_idx" ON "OwnerProfile"("approvedAt");

-- Existing venues are treated as approved (PRODUCT.md, "Venue owners"): they go live
-- at the moment of the migration. New venues start with approvedAt null ("Pending
-- review"). (Added by hand to the generated SQL.)
UPDATE "OwnerProfile" SET "approvedAt" = CURRENT_TIMESTAMP;
