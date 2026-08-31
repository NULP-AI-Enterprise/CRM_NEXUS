-- AlterTable
ALTER TABLE "Community" ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "fullSummary" TEXT,
ADD COLUMN     "linkedin" TEXT,
ADD COLUMN     "needs" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "usefulnessScore" SMALLINT,
ADD COLUMN     "valuePotential" TEXT;

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "fullSummary" TEXT,
ADD COLUMN     "linkedin" TEXT,
ADD COLUMN     "needs" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "usefulnessScore" SMALLINT,
ADD COLUMN     "valuePotential" TEXT;
