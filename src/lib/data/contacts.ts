import { prisma } from "@/lib/prisma";

export async function getContactDetail(userId: string, contactId: string) {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, userId },
    include: {
      company: {
        include: {
          contacts: {
            where: { id: { not: contactId } },
            select: { id: true, fullName: true, role: true, category: true },
          },
        },
      },
      interactions: {
        orderBy: { createdAt: "desc" },
      },
      outgoingConnections: {
        include: {
          toContact: {
            include: { company: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      incomingConnections: {
        include: {
          fromContact: {
            include: { company: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!contact) return null;

  // Also fetch list of available other contacts to connect with
  const otherContacts = await prisma.contact.findMany({
    where: {
      userId,
      id: { not: contactId },
    },
    select: {
      id: true,
      fullName: true,
      role: true,
      companyName: true,
      category: true,
    },
    orderBy: { fullName: "asc" },
  });

  return {
    ...contact,
    otherContacts,
  };
}

export async function listContacts(userId: string) {
  return prisma.contact.findMany({
    where: { userId },
    orderBy: [
      { usefulnessScore: "desc" },
      { fullName: "asc" },
    ],
  });
}

