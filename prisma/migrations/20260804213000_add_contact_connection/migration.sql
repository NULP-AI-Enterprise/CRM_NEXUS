-- CreateTable
CREATE TABLE IF NOT EXISTS "ContactConnection" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ContactConnection_contactId_idx" ON "ContactConnection"("contactId");

-- AddForeignKey
ALTER TABLE "ContactConnection" ADD CONSTRAINT "ContactConnection_contactId_fkey" 
FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
