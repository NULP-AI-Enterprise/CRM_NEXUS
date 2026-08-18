import { prisma } from "@/lib/prisma";
import type { TimelineEvent } from "@/lib/timeline-entity";

export async function getTimelineData(userId: string): Promise<TimelineEvent[]> {
  const [contactInteractions, connectionInteractions] = await Promise.all([
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

  events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return events;
}
