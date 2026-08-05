import { prisma } from "@/lib/prisma";
import type { ContactCategory } from "@/generated/prisma/enums";

export interface GraphContactNode {
  id: string;
  nodeType: "contact";
  name: string;
  role: string | null;
  companyId: string | null;
  companyName: string | null;
  category: ContactCategory;
  usefulnessScore: number | null;
  temperament: string | null;
  needs: string | null;
  valuePotential: string | null;
  fullSummary: string | null;
  interactionsCount: number;
  lastInteractionAt: string | null;
  connectionsCount: number;
}

export interface GraphCompanyNode {
  id: string;
  nodeType: "company";
  name: string;
  industry: string | null;
  description: string | null;
  contactCount: number;
}

export type GraphNode = GraphContactNode | GraphCompanyNode;

export interface GraphLink {
  id: string;
  source: string;
  target: string;
  type: "direct" | "company_hub" | "colleague";
  relationship: string | null;
  strength: number; // 1-5
  notes: string | null;
}

export interface NetworkStats {
  totalContacts: number;
  totalCompanies: number;
  totalConnections: number;
  avgScore: number;
  topHubs: Array<{ id: string; name: string; degree: number; category: ContactCategory }>;
  categoryCounts: Record<ContactCategory, number>;
}

export interface FullGraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  stats: NetworkStats;
  allContactsList: Array<{
    id: string;
    fullName: string;
    role: string | null;
    companyName: string | null;
    category: ContactCategory;
    usefulnessScore: number | null;
  }>;
}

export async function getGraphData(userId: string): Promise<FullGraphData> {
  const [contacts, companies, explicitConnections] = await Promise.all([
    prisma.contact.findMany({
      where: { userId },
      include: {
        company: true,
        interactions: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        outgoingConnections: {
          include: { toContact: true },
        },
        incomingConnections: {
          include: { fromContact: true },
        },
      },
      orderBy: { fullName: "asc" },
    }),
    prisma.company.findMany({
      where: { userId },
      include: {
        contacts: {
          select: { id: true, fullName: true, role: true, category: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.contactConnection.findMany({
      where: { userId },
    }),
  ]);

  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const linkIdSet = new Set<string>();
  const degreeMap = new Map<string, number>();

  const categoryCounts: Record<ContactCategory, number> = {
    VIP: 0,
    HR: 0,
    INVESTOR: 0,
    LEAD: 0,
    COLLEAGUE: 0,
    FRIEND: 0,
    OTHER: 0,
  };

  let totalScoreSum = 0;
  let scoredCount = 0;

  // 1. Add Contact Nodes
  for (const c of contacts) {
    categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;
    if (c.usefulnessScore != null) {
      totalScoreSum += c.usefulnessScore;
      scoredCount++;
    }

    const connCount = c.outgoingConnections.length + c.incomingConnections.length;

    nodes.push({
      id: c.id,
      nodeType: "contact",
      name: c.fullName,
      role: c.role,
      companyId: c.companyId,
      companyName: c.company?.name || c.companyName || null,
      category: c.category,
      usefulnessScore: c.usefulnessScore,
      temperament: c.temperament,
      needs: c.needs,
      valuePotential: c.valuePotential,
      fullSummary: c.fullSummary,
      interactionsCount: c.interactions.length,
      lastInteractionAt: c.interactions[0]?.createdAt.toISOString() || null,
      connectionsCount: connCount,
    });
  }

  // 2. Add Company Hub Nodes
  for (const comp of companies) {
    if (comp.contacts.length > 0) {
      const compNodeId = `comp_${comp.id}`;
      nodes.push({
        id: compNodeId,
        nodeType: "company",
        name: comp.name,
        industry: comp.industry,
        description: comp.description,
        contactCount: comp.contacts.length,
      });

      // Link contacts to Company Hub
      for (const emp of comp.contacts) {
        const linkId = `hub_${compNodeId}_${emp.id}`;
        if (!linkIdSet.has(linkId)) {
          linkIdSet.add(linkId);
          links.push({
            id: linkId,
            source: compNodeId,
            target: emp.id,
            type: "company_hub",
            relationship: "Компанія",
            strength: 2,
            notes: `${comp.name}`,
          });
          degreeMap.set(emp.id, (degreeMap.get(emp.id) || 0) + 1);
          degreeMap.set(compNodeId, (degreeMap.get(compNodeId) || 0) + 1);
        }
      }

      // Also create intra-company colleague links if 2+ employees in same company
      for (let i = 0; i < comp.contacts.length; i++) {
        for (let j = i + 1; j < comp.contacts.length; j++) {
          const empA = comp.contacts[i]!.id;
          const empB = comp.contacts[j]!.id;
          const colleagueLinkId = `colleague_${empA}_${empB}`;
          if (!linkIdSet.has(colleagueLinkId)) {
            linkIdSet.add(colleagueLinkId);
            links.push({
              id: colleagueLinkId,
              source: empA,
              target: empB,
              type: "colleague",
              relationship: `Колеги (${comp.name})`,
              strength: 2,
              notes: comp.name,
            });
            degreeMap.set(empA, (degreeMap.get(empA) || 0) + 1);
            degreeMap.set(empB, (degreeMap.get(empB) || 0) + 1);
          }
        }
      }
    }
  }

  // 3. Add Explicit Contact-to-Contact Connections
  for (const conn of explicitConnections) {
    const pairId = [conn.fromContactId, conn.toContactId].sort().join("_");
    const directLinkId = `direct_${pairId}`;
    if (!linkIdSet.has(directLinkId)) {
      linkIdSet.add(directLinkId);
      links.push({
        id: directLinkId,
        source: conn.fromContactId,
        target: conn.toContactId,
        type: "direct",
        relationship: conn.relationship || "Зв'язок",
        strength: Math.max(1, Math.min(5, conn.strength || 3)),
        notes: conn.notes,
      });
      degreeMap.set(conn.fromContactId, (degreeMap.get(conn.fromContactId) || 0) + 2);
      degreeMap.set(conn.toContactId, (degreeMap.get(conn.toContactId) || 0) + 2);
    }
  }

  // Top Hubs
  const topHubs = contacts
    .map((c) => ({
      id: c.id,
      name: c.fullName,
      degree: degreeMap.get(c.id) || 0,
      category: c.category,
    }))
    .sort((a, b) => b.degree - a.degree)
    .slice(0, 5);

  const avgScore = scoredCount > 0 ? Math.round((totalScoreSum / scoredCount) * 10) / 10 : 0;

  const stats: NetworkStats = {
    totalContacts: contacts.length,
    totalCompanies: companies.length,
    totalConnections: links.length,
    avgScore,
    topHubs,
    categoryCounts,
  };

  const allContactsList = contacts.map((c) => ({
    id: c.id,
    fullName: c.fullName,
    role: c.role,
    companyName: c.company?.name || c.companyName || null,
    category: c.category,
    usefulnessScore: c.usefulnessScore,
  }));

  return {
    nodes,
    links,
    stats,
    allContactsList,
  };
}
