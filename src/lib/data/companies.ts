import { prisma } from "@/lib/prisma";
import type { ContactCategory } from "@/generated/prisma/enums";

export interface CompanyGraphMember {
  id: string;
  fullName: string;
  category: ContactCategory;
  interactionCount: number;
  lastInteractionAt: string | null;
}

export interface CompanyGraphEdge {
  aId: string;
  bId: string;
  relationship: string | null;
}

export interface CompanyGraphData {
  id: string;
  name: string;
  industry: string | null;
  description: string | null;
  members: CompanyGraphMember[];
  edges: CompanyGraphEdge[];
  totalInteractions: number;
  mostActiveMemberId: string | null;
}

/** Same shape as the community graph data — how a company's own people relate
 * to each other (real `ContactConnection` rows where both ends work there),
 * plus enough per-person activity to answer "who's actually active here." */
export async function getCompanyGraphData(userId: string, companyId: string): Promise<CompanyGraphData | null> {
  const company = await prisma.company.findFirst({
    where: { id: companyId, userId },
    include: { contacts: { select: { id: true, fullName: true, category: true } } },
  });
  if (!company) return null;

  const memberIds = company.contacts.map((c) => c.id);
  if (memberIds.length === 0) {
    return {
      id: company.id,
      name: company.name,
      industry: company.industry,
      description: company.description,
      members: [],
      edges: [],
      totalInteractions: 0,
      mostActiveMemberId: null,
    };
  }

  const [connections, interactionCounts] = await Promise.all([
    prisma.contactConnection.findMany({
      where: { userId, fromContactId: { in: memberIds }, toContactId: { in: memberIds } },
      select: { fromContactId: true, toContactId: true, relationship: true },
    }),
    prisma.interaction.findMany({
      where: { contact: { id: { in: memberIds }, userId } },
      select: { contactId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const countByMember = new Map<string, number>();
  const lastByMember = new Map<string, string>();
  for (const i of interactionCounts) {
    if (!i.contactId) continue;
    countByMember.set(i.contactId, (countByMember.get(i.contactId) ?? 0) + 1);
    if (!lastByMember.has(i.contactId)) lastByMember.set(i.contactId, i.createdAt.toISOString());
  }

  const members: CompanyGraphMember[] = company.contacts.map((c) => ({
    id: c.id,
    fullName: c.fullName,
    category: c.category,
    interactionCount: countByMember.get(c.id) ?? 0,
    lastInteractionAt: lastByMember.get(c.id) ?? null,
  }));

  const mostActiveMemberId = members.reduce<{ id: string | null; count: number }>(
    (best, m) => (m.interactionCount > best.count ? { id: m.id, count: m.interactionCount } : best),
    { id: null, count: 0 },
  ).id;

  return {
    id: company.id,
    name: company.name,
    industry: company.industry,
    description: company.description,
    members,
    edges: connections.map((c) => ({ aId: c.fromContactId, bId: c.toContactId, relationship: c.relationship })),
    totalInteractions: interactionCounts.length,
    mostActiveMemberId,
  };
}

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
