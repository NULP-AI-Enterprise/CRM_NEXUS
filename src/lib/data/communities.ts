import { prisma } from "@/lib/prisma";

export async function getCommunitiesWithContacts(userId: string) {
  return prisma.community.findMany({
    where: { userId },
    include: {
      contacts: {
        orderBy: { updatedAt: "desc" },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function listCommunities(userId: string) {
  return prisma.community.findMany({
    where: { userId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
