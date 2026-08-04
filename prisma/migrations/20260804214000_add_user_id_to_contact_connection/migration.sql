-- AlterTable
ALTER TABLE "ContactConnection" ADD COLUMN IF NOT EXISTS "userId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ContactConnection_userId_idx" ON "ContactConnection"("userId");

-- AddForeignKey
ALTER TABLE "ContactConnection" ADD CONSTRAINT "ContactConnection_userId_fkey" 
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
