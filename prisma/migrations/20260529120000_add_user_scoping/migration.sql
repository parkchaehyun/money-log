-- Add per-user ownership to all data models.
--
-- Existing single-user deployments: every row is backfilled to the first
-- User (oldest by createdAt). This requires that at least one User row exists
-- before running the migration on a database that already contains data.
-- Fresh databases (no rows yet) are unaffected by the backfill.

-- 1) Add userId columns as nullable so existing rows can be backfilled.
ALTER TABLE "Transaction" ADD COLUMN "userId" TEXT;
ALTER TABLE "IncomeEvent" ADD COLUMN "userId" TEXT;
ALTER TABLE "Category" ADD COLUMN "userId" TEXT;
ALTER TABLE "Card" ADD COLUMN "userId" TEXT;
ALTER TABLE "PaymentMethod" ADD COLUMN "userId" TEXT;
ALTER TABLE "Tag" ADD COLUMN "userId" TEXT;

-- 2) Backfill existing rows to the oldest user. Fails loudly if data exists
--    but no user is present to own it.
DO $$
DECLARE
  owner_id TEXT;
  orphan_count INT;
BEGIN
  SELECT "id" INTO owner_id FROM "User" ORDER BY "createdAt" ASC LIMIT 1;

  IF owner_id IS NULL THEN
    SELECT
      (SELECT count(*) FROM "Transaction")
      + (SELECT count(*) FROM "IncomeEvent")
      + (SELECT count(*) FROM "Category")
      + (SELECT count(*) FROM "Card")
      + (SELECT count(*) FROM "PaymentMethod")
      + (SELECT count(*) FROM "Tag")
    INTO orphan_count;

    IF orphan_count > 0 THEN
      RAISE EXCEPTION 'Cannot backfill userId: existing data found but no User exists. Create a User first, then re-run the migration.';
    END IF;
  ELSE
    UPDATE "Transaction" SET "userId" = owner_id WHERE "userId" IS NULL;
    UPDATE "IncomeEvent" SET "userId" = owner_id WHERE "userId" IS NULL;
    UPDATE "Category" SET "userId" = owner_id WHERE "userId" IS NULL;
    UPDATE "Card" SET "userId" = owner_id WHERE "userId" IS NULL;
    UPDATE "PaymentMethod" SET "userId" = owner_id WHERE "userId" IS NULL;
    UPDATE "Tag" SET "userId" = owner_id WHERE "userId" IS NULL;
  END IF;
END $$;

-- 3) Enforce NOT NULL now that rows are backfilled.
ALTER TABLE "Transaction" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "IncomeEvent" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Category" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Card" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "PaymentMethod" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Tag" ALTER COLUMN "userId" SET NOT NULL;

-- 4) Replace global unique-name constraints with per-user uniques.
DROP INDEX "Category_name_key";
DROP INDEX "Card_name_key";
DROP INDEX "Tag_name_key";

CREATE UNIQUE INDEX "Category_userId_name_key" ON "Category"("userId", "name");
CREATE UNIQUE INDEX "Card_userId_name_key" ON "Card"("userId", "name");
CREATE UNIQUE INDEX "Tag_userId_name_key" ON "Tag"("userId", "name");

-- 5) Index userId for scoped lookups.
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");
CREATE INDEX "IncomeEvent_userId_idx" ON "IncomeEvent"("userId");
CREATE INDEX "Category_userId_idx" ON "Category"("userId");
CREATE INDEX "Card_userId_idx" ON "Card"("userId");
CREATE INDEX "PaymentMethod_userId_idx" ON "PaymentMethod"("userId");
CREATE INDEX "Tag_userId_idx" ON "Tag"("userId");

-- 6) Wire up foreign keys (cascade so deleting a user removes their data).
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncomeEvent" ADD CONSTRAINT "IncomeEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Card" ADD CONSTRAINT "Card_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
