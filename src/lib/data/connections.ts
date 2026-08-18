import { prisma } from "@/lib/prisma";

export interface ConnectionWithNames {
  id: string;
  fromContactId: string;
  toContactId: string;
  fromName: string;
  toName: string;
  relationship: string | null;
  strength: number;
}

/** Real ContactConnection.id per row — unlike graph.ts's links, which use a
 *  synthetic `direct_${sortedPairIds}` id for de-duplication in the
 *  visualization and were never meant to be looked up by afterward. */
export async function getConnectionsWithNames(userId: string): Promise<ConnectionWithNames[]> {
  const connections = await prisma.contactConnection.findMany({
    where: { userId },
    include: {
      fromContact: { select: { fullName: true } },
      toContact: { select: { fullName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return connections.map((c) => ({
    id: c.id,
    fromContactId: c.fromContactId,
    toContactId: c.toContactId,
    fromName: c.fromContact.fullName,
    toName: c.toContact.fullName,
    relationship: c.relationship,
    strength: c.strength,
  }));
}
