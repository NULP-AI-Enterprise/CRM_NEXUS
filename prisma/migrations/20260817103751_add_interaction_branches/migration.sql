-- AlterTable
ALTER TABLE "Interaction" ADD COLUMN     "parentInteractionId" TEXT;

-- CreateIndex
CREATE INDEX "Interaction_parentInteractionId_idx" ON "Interaction"("parentInteractionId");

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_parentInteractionId_fkey" FOREIGN KEY ("parentInteractionId") REFERENCES "Interaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
