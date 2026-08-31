import { prisma } from "@/lib/prisma";
import type { TimelineEvent } from "@/lib/timeline-entity";
import type { ConnectionWithNames } from "@/lib/data/connections";

export async function getTimelineData(userId: string): Promise<TimelineEvent[]> {
  const [contactInteractions, connectionInteractions, companyInteractions, communityInteractions] = await Promise.all([
    prisma.interaction.findMany({
      where: { contact: { userId } },
      include: {
        contact: { select: { id: true, fullName: true, category: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.interaction.findMany({
      where: { connection: { userId } },
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
      orderBy: { createdAt: "desc" },
    }),
    prisma.interaction.findMany({
      where: { company: { userId } },
      include: { company: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.interaction.findMany({
      where: { community: { userId } },
      include: { community: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const events: TimelineEvent[] = [];

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

  for (const i of companyInteractions) {
    if (!i.company) continue;
    events.push({
      id: i.id,
      type: i.type,
      rawText: i.rawText,
      followUp: i.followUp,
      followUpDate: i.followUpDate?.toISOString() ?? null,
      createdAt: i.createdAt.toISOString(),
      parentInteractionId: i.parentInteractionId,
      entity: { kind: "company", company: i.company },
    });
  }

  for (const i of communityInteractions) {
    if (!i.community) continue;
    events.push({
      id: i.id,
      type: i.type,
      rawText: i.rawText,
      followUp: i.followUp,
      followUpDate: i.followUpDate?.toISOString() ?? null,
      createdAt: i.createdAt.toISOString(),
      parentInteractionId: i.parentInteractionId,
      entity: { kind: "community", community: i.community },
    });
  }

  events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return events;
}

/** Same event shape `getTimelineData` produces, scoped to one Company or
 * Community: the org's own log, its member contacts' own interactions, and
 * interactions on connections where both parties are members — plus the
 * `ContactConnection` edges among just those members. Fed straight into
 * `HistoryGraphView`, which already buckets any contact with no edges into
 * its own singleton lane, so members who aren't connected to each other
 * "just work" — no scoping logic needed in the component itself. */
export async function getOrgHistoryData(
  userId: string,
  kind: "company" | "community",
  orgId: string,
): Promise<{ events: TimelineEvent[]; connections: ConnectionWithNames[] } | null> {
  const org =
    kind === "company"
      ? await prisma.company.findFirst({
          where: { id: orgId, userId },
          include: { contacts: { select: { id: true } } },
        })
      : await prisma.community.findFirst({
          where: { id: orgId, userId },
          include: { contacts: { select: { id: true } } },
        });
  if (!org) return null;

  const memberIds = org.contacts.map((c) => c.id);

  const ownEvents: TimelineEvent[] =
    kind === "company"
      ? (
          await prisma.interaction.findMany({
            where: { companyId: orgId },
            include: { company: { select: { id: true, name: true } } },
            orderBy: { createdAt: "desc" },
          })
        )
          .filter((i) => i.company)
          .map((i) => ({
            id: i.id,
            type: i.type,
            rawText: i.rawText,
            followUp: i.followUp,
            followUpDate: i.followUpDate?.toISOString() ?? null,
            createdAt: i.createdAt.toISOString(),
            parentInteractionId: i.parentInteractionId,
            entity: { kind: "company" as const, company: i.company! },
          }))
      : (
          await prisma.interaction.findMany({
            where: { communityId: orgId },
            include: { community: { select: { id: true, name: true } } },
            orderBy: { createdAt: "desc" },
          })
        )
          .filter((i) => i.community)
          .map((i) => ({
            id: i.id,
            type: i.type,
            rawText: i.rawText,
            followUp: i.followUp,
            followUpDate: i.followUpDate?.toISOString() ?? null,
            createdAt: i.createdAt.toISOString(),
            parentInteractionId: i.parentInteractionId,
            entity: { kind: "community" as const, community: i.community! },
          }));

  const [memberContactInteractions, memberConnectionInteractions, memberConnections] = await Promise.all([
    memberIds.length === 0
      ? []
      : prisma.interaction.findMany({
          where: { contact: { id: { in: memberIds }, userId } },
          include: { contact: { select: { id: true, fullName: true, category: true } } },
          orderBy: { createdAt: "desc" },
        }),
    memberIds.length === 0
      ? []
      : prisma.interaction.findMany({
          where: { connection: { userId, fromContactId: { in: memberIds }, toContactId: { in: memberIds } } },
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
          orderBy: { createdAt: "desc" },
        }),
    memberIds.length === 0
      ? []
      : prisma.contactConnection.findMany({
          where: { userId, fromContactId: { in: memberIds }, toContactId: { in: memberIds } },
          include: {
            fromContact: { select: { fullName: true } },
            toContact: { select: { fullName: true } },
          },
        }),
  ]);

  const events: TimelineEvent[] = [...ownEvents];

  for (const i of memberContactInteractions) {
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

  for (const i of memberConnectionInteractions) {
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

  const connections: ConnectionWithNames[] = memberConnections.map((c) => ({
    id: c.id,
    fromContactId: c.fromContactId,
    toContactId: c.toContactId,
    fromName: c.fromContact.fullName,
    toName: c.toContact.fullName,
    relationship: c.relationship,
    strength: c.strength,
  }));

  return { events, connections };
}
