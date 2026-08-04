-- AlterTable
ALTER TABLE "ContactConnection" ADD COLUMN IF NOT EXISTS "fromContactId" TEXT;
ALTER TABLE "ContactConnection" ADD COLUMN IF NOT EXISTS "toContactId" TEXT;
ALTER TABLE "ContactConnection" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "ContactConnection" ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- CreateIndexes
CREATE INDEX IF NOT EXISTS "ContactConnection_fromContactId_idx" ON "ContactConnection"("fromContactId");
CREATE INDEX IF NOT EXISTS "ContactConnection_toContactId_idx" ON "ContactConnection"("toContactId");
CREATE INDEX IF NOT EXISTS "ContactConnection_userId_idx" ON "ContactConnection"("userId");

-- AddForeignKeys
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ContactConnection_fromContactId_fkey') THEN
        ALTER TABLE "ContactConnection" ADD CONSTRAINT "ContactConnection_fromContactId_fkey" 
        FOREIGN KEY ("fromContactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ContactConnection_toContactId_fkey') THEN
        ALTER TABLE "ContactConnection" ADD CONSTRAINT "ContactConnection_toContactId_fkey" 
        FOREIGN KEY ("toContactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ContactConnection_userId_fkey') THEN
        ALTER TABLE "ContactConnection" ADD CONSTRAINT "ContactConnection_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
