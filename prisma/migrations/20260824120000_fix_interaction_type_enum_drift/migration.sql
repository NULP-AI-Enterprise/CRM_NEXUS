-- The `init` migration (20260804084838) created InteractionType with the
-- app's original, since-renamed labels: 'CALL', 'MEET', 'ZOOM', 'OFFLINE',
-- 'NOTE'. schema.prisma was later updated to the current labels (MEETING,
-- CALL, INTRO, EMAIL, WORKSHOP, MEMO) without a matching migration ever
-- being committed. Local/dev databases only match today because they were
-- reset or `db push`-ed out of band; any database that has only ever run
-- `prisma migrate deploy` (production) still has the original enum, and
-- existing rows use its labels -- which is why the app errors reading them
-- with "Value 'NOTE' not found in enum 'InteractionType'" once deployed
-- code built against the new schema.
--
-- This migration brings such a database in line, remapping existing rows so
-- no data is lost. It is also safe to run on a database already on the new
-- labels (e.g. local dev) -- the CASE just passes those rows through
-- unchanged via the ELSE branch.

CREATE TYPE "InteractionType_new" AS ENUM ('MEETING', 'CALL', 'INTRO', 'EMAIL', 'WORKSHOP', 'MEMO');

ALTER TABLE "Interaction" ALTER COLUMN "type" DROP DEFAULT;

ALTER TABLE "Interaction"
  ALTER COLUMN "type" TYPE "InteractionType_new"
  USING (
    CASE "type"::text
      WHEN 'MEET' THEN 'MEETING'
      WHEN 'ZOOM' THEN 'CALL'
      WHEN 'OFFLINE' THEN 'MEETING'
      WHEN 'NOTE' THEN 'MEMO'
      ELSE "type"::text
    END
  )::"InteractionType_new";

ALTER TABLE "Interaction" ALTER COLUMN "type" SET DEFAULT 'MEMO';

DROP TYPE "InteractionType";

ALTER TYPE "InteractionType_new" RENAME TO "InteractionType";
