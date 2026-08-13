-- AlterTable
ALTER TABLE "Interaction" ADD COLUMN     "connectionId" TEXT,
ADD COLUMN     "followUpDate" TIMESTAMP(3),
ALTER COLUMN "contactId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Interaction_connectionId_idx" ON "Interaction"("connectionId");

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ContactConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
