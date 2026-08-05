import { prisma } from "@/lib/prisma";

export async function getCompaniesWithContacts(userId: string) {
  const companies = await prisma.company.findMany({
    where: { userId },
    include: {
      contacts: {
        orderBy: { updatedAt: "desc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const unassignedContacts = await prisma.contact.findMany({
    where: { userId, companyId: null },
    orderBy: { updatedAt: "desc" },
  });

  return { companies, unassignedContacts };
}

export async function listCompanies(userId: string) {
  return prisma.company.findMany({
    where: { userId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
