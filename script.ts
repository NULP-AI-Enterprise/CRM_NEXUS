import { prisma } from "./src/lib/prisma";
async function main() {
  await prisma.$executeRawUnsafe(`ALTER TYPE "InteractionType" ADD VALUE 'MEETING';`);
  await prisma.$executeRawUnsafe(`ALTER TYPE "InteractionType" ADD VALUE 'INTRO';`);
  await prisma.$executeRawUnsafe(`ALTER TYPE "InteractionType" ADD VALUE 'EMAIL';`);
  await prisma.$executeRawUnsafe(`ALTER TYPE "InteractionType" ADD VALUE 'WORKSHOP';`);
  await prisma.$executeRawUnsafe(`ALTER TYPE "InteractionType" ADD VALUE 'MEMO';`);
  
  await prisma.$executeRawUnsafe(`UPDATE "Interaction" SET type = 'MEETING' WHERE type = 'MEET';`);
  await prisma.$executeRawUnsafe(`UPDATE "Interaction" SET type = 'MEMO' WHERE type = 'NOTE';`);
  await prisma.$executeRawUnsafe(`UPDATE "Interaction" SET type = 'INTRO' WHERE type = 'OFFLINE';`);
  await prisma.$executeRawUnsafe(`UPDATE "Interaction" SET type = 'EMAIL' WHERE type = 'ZOOM';`);
  
  console.log("Done");
}
main().catch(console.error).finally(() => prisma.$disconnect());
