import { prisma } from "@/lib/prisma";
import type { ContactCategory } from "@/generated/prisma/enums";
import type { ClusterEvent } from "@/lib/timeline-entity";

export interface ClusterMember {
  id: string;
  fullName: string;
  category: ContactCategory;
}

export interface ClusterEdge {
  id: string;
  fromContactId: string;
  toContactId: string;
  relationship: string | null;
}

export interface ClusterDiagramData {
  seedContactId: string;
  members: ClusterMember[];
  edges: ClusterEdge[];
  events: ClusterEvent[];
}

/** A timeline entity key ("contact:ID" or "connection:ID") names either a
 *  single contact or a connection between two — either way, the contact
 *  it resolves to just seeds the cluster walk below. */
async function resolveSeedContactId(userId: string, entityKey: string): Promise<string | null> {
  const [kind, id] = entityKey.split(":");
  if (!id) return null;

  if (kind === "contact") {
    const contact = await prisma.contact.findFirst({ where: { id, userId }, select: { id: true } });
    return contact?.id ?? null;
  }
  if (kind === "connection") {
    const connection = await prisma.contactConnection.findFirst({
      where: { id, userId },
      select: { fromContactId: true },
    });
    return connection?.fromContactId ?? null;
  }
  return null;
}

/** Every interaction's own contact set — [contactId] for a contact-attached
 *  row, [fromContactId, toContactId] for a connection-attached one — plus its
 *  parentInteractionId, fetched account-wide so a branch can be discovered
 *  even before any ContactConnection links its entity into the cluster. */
async function fetchInteractionProvenance(userId: string) {
  const rows = await prisma.interaction.findMany({
    where: { OR: [{ contact: { userId } }, { connection: { userId } }] },
    select: {
      id: true,
      parentInteractionId: true,
      contactId: true,
      connection: { select: { fromContactId: true, toContactId: true } },
    },
  });

  const contactsByInteraction = new Map<string, string[]>();
  const parentByInteraction = new Map<string, string | null>();
  for (const row of rows) {
    contactsByInteraction.set(
      row.id,
      row.contactId ? [row.contactId] : row.connection ? [row.connection.fromContactId, row.connection.toContactId] : [],
    );
    parentByInteraction.set(row.id, row.parentInteractionId);
  }
  return { contactsByInteraction, parentByInteraction };
}

/** Resolves the entity key to a seed contact, then walks the connected
 *  component containing it (BFS — trivially fast at personal-CRM scale) over
 *  two kinds of edges: real ContactConnection rows, and provenance links
 *  implied by parentInteractionId crossing from one contact's event to
 *  another's (X introduces Y — a branch's entity doesn't have to match its
 *  parent's). A cluster is never persisted: it's recomputed every time, so
 *  there's nothing to name or store. */
export async function getClusterDiagramData(userId: string, entityKey: string): Promise<ClusterDiagramData | null> {
  const seedContactId = await resolveSeedContactId(userId, entityKey);
  if (!seedContactId) return null;

  const [allConnections, { contactsByInteraction, parentByInteraction }] = await Promise.all([
    prisma.contactConnection.findMany({
      where: { userId },
      select: { id: true, fromContactId: true, toContactId: true, relationship: true },
    }),
    fetchInteractionProvenance(userId),
  ]);

  // `edge: null` marks a provenance-only link (no real ContactConnection row
  // behind it) — it counts for membership discovery but never becomes a
  // rendered relationship, so it's excluded when building clusterEdges below.
  const adjacency = new Map<string, Array<{ peerId: string; edge: (typeof allConnections)[number] | null }>>();
  const link = (a: string, b: string, edge: (typeof allConnections)[number] | null) => {
    if (a === b) return;
    if (!adjacency.has(a)) adjacency.set(a, []);
    if (!adjacency.has(b)) adjacency.set(b, []);
    adjacency.get(a)!.push({ peerId: b, edge });
    adjacency.get(b)!.push({ peerId: a, edge });
  };

  for (const conn of allConnections) {
    link(conn.fromContactId, conn.toContactId, conn);
  }
  for (const [interactionId, parentId] of parentByInteraction) {
    if (!parentId) continue;
    const childContacts = contactsByInteraction.get(interactionId) ?? [];
    const parentContacts = contactsByInteraction.get(parentId) ?? [];
    for (const c of childContacts) {
      for (const p of parentContacts) {
        link(c, p, null);
      }
    }
  }

  const memberIds = new Set<string>([seedContactId]);
  const clusterEdges: ClusterEdge[] = [];
  const clusterEdgeIds = new Set<string>();
  const queue = [seedContactId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const { peerId, edge } of adjacency.get(current) ?? []) {
      if (edge && !clusterEdgeIds.has(edge.id)) {
        clusterEdgeIds.add(edge.id);
        clusterEdges.push({
          id: edge.id,
          fromContactId: edge.fromContactId,
          toContactId: edge.toContactId,
          relationship: edge.relationship,
        });
      }
      if (!memberIds.has(peerId)) {
        memberIds.add(peerId);
        queue.push(peerId);
      }
    }
  }

  const memberIdList = Array.from(memberIds);
  const [contacts, contactInteractions, connectionInteractions] = await Promise.all([
    prisma.contact.findMany({
      where: { id: { in: memberIdList }, userId },
      select: { id: true, fullName: true, category: true },
    }),
    prisma.interaction.findMany({
      where: { contact: { id: { in: memberIdList }, userId } },
      include: { contact: { select: { id: true, fullName: true, category: true } } },
      orderBy: { createdAt: "asc" },
    }),
    clusterEdges.length > 0
      ? prisma.interaction.findMany({
          where: { connection: { id: { in: Array.from(clusterEdgeIds) }, userId } },
          include: {
            connection: {
              select: {
                id: true,
                relationship: true,
                fromContact: { select: { id: true, fullName: true } },
                toContact: { select: { id: true, fullName: true } },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const events: ClusterEvent[] = [];

  for (const i of contactInteractions) {
    if (!i.contact) continue;
    events.push({
      id: i.id,
      type: i.type,
      rawText: i.rawText,
      followUp: i.followUp,
      followUpDate: i.followUpDate?.toISOString() ?? null,
      createdAt: i.createdAt.toISOString(),
      parentInteractionId: i.parentInteractionId,
      entity: { kind: "contact", contact: i.contact },
    });
  }

  for (const i of connectionInteractions) {
    if (!i.connection) continue;
    events.push({
      id: i.id,
      type: i.type,
      rawText: i.rawText,
      followUp: i.followUp,
      followUpDate: i.followUpDate?.toISOString() ?? null,
      createdAt: i.createdAt.toISOString(),
      parentInteractionId: i.parentInteractionId,
      entity: {
        kind: "connection",
        connection: { id: i.connection.id, relationship: i.connection.relationship },
        fromContact: i.connection.fromContact,
        toContact: i.connection.toContact,
      },
    });
  }

  events.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return {
    seedContactId,
    members: contacts.map((c) => ({ id: c.id, fullName: c.fullName, category: c.category })),
    edges: clusterEdges,
    events,
  };
}
