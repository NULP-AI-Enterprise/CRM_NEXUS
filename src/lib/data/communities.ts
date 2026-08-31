import { prisma } from "@/lib/prisma";
import type { ContactCategory } from "@/generated/prisma/enums";

export interface CommunityGraphMember {
  id: string;
  fullName: string;
  category: ContactCategory;
  interactionCount: number;
  lastInteractionAt: string | null;
}

export interface CommunityGraphEdge {
  aId: string;
  bId: string;
  relationship: string | null;
}

export interface CommunityOwnInteraction {
  id: string;
  rawText: string;
  type: string;
  createdAt: string;
}

export interface CommunityGraphData {
  id: string;
  name: string;
  description: string | null;
  linkedin: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  usefulnessScore: number | null;
  needs: string | null;
  valuePotential: string | null;
  fullSummary: string | null;
  members: CommunityGraphMember[];
  edges: CommunityGraphEdge[];
  totalInteractions: number;
  mostActiveMemberId: string | null;
  /** Events logged against the community itself, not any one member —
   * distinct from totalInteractions, which aggregates member-contacts' own
   * logs. */
  ownInteractions: CommunityOwnInteraction[];
}

/** Everything a community "detail" panel needs beyond the flat member grid
 * already shown in the accordion: how members relate to *each other* (real
 * `ContactConnection` rows where both ends are members — never a link to
 * someone outside the community), and enough per-member activity to answer
 * "who's actually active here" at a glance. */
export async function getCommunityGraphData(userId: string, communityId: string): Promise<CommunityGraphData | null> {
  const community = await prisma.community.findFirst({
    where: { id: communityId, userId },
    include: { contacts: { select: { id: true, fullName: true, category: true } } },
  });
  if (!community) return null;

  const memberIds = community.contacts.map((c) => c.id);

  const ownInteractionRows = await prisma.interaction.findMany({
    where: { communityId: community.id },
    select: { id: true, rawText: true, type: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const ownInteractions: CommunityOwnInteraction[] = ownInteractionRows.map((i) => ({
    id: i.id,
    rawText: i.rawText,
    type: i.type,
    createdAt: i.createdAt.toISOString(),
  }));

  if (memberIds.length === 0) {
    return {
      id: community.id,
      name: community.name,
      description: community.description,
      linkedin: community.linkedin,
      phone: community.phone,
      city: community.city,
      country: community.country,
      usefulnessScore: community.usefulnessScore,
      needs: community.needs,
      valuePotential: community.valuePotential,
      fullSummary: community.fullSummary,
      members: [],
      edges: [],
      totalInteractions: 0,
      mostActiveMemberId: null,
      ownInteractions,
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

  const members: CommunityGraphMember[] = community.contacts.map((c) => ({
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
    id: community.id,
    name: community.name,
    description: community.description,
    linkedin: community.linkedin,
    phone: community.phone,
    city: community.city,
    country: community.country,
    usefulnessScore: community.usefulnessScore,
    needs: community.needs,
    valuePotential: community.valuePotential,
    fullSummary: community.fullSummary,
    members,
    edges: connections.map((c) => ({ aId: c.fromContactId, bId: c.toContactId, relationship: c.relationship })),
    totalInteractions: interactionCounts.length,
    mostActiveMemberId,
    ownInteractions,
  };
}

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
