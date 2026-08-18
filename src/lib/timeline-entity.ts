import type { InteractionType } from "@/generated/prisma/enums";

export type TimelineEntity =
  | { kind: "contact"; contact: { id: string; fullName: string; category: string } }
  | {
      kind: "connection";
      connection: { id: string; relationship: string | null };
      fromContact: { id: string; fullName: string };
      toContact: { id: string; fullName: string };
    };

export interface TimelineEvent {
  id: string;
  type: InteractionType;
  rawText: string;
  followUp: string | null;
  followUpDate: string | null;
  createdAt: string;
  /** Null when this event lives on the main line; otherwise the id of the
   * event it branches off of. */
  parentInteractionId: string | null;
  entity: TimelineEntity;
}

/** Stable per-entity key for grouping events into timeline lanes. */
export function entityKey(entity: TimelineEntity): string {
  return entity.kind === "contact" ? `contact:${entity.contact.id}` : `connection:${entity.connection.id}`;
}

/** Human label for an entity's lane. */
export function entityLabel(entity: TimelineEntity): string {
  return entity.kind === "contact"
    ? entity.contact.fullName
    : `${entity.fromContact.fullName} ↔ ${entity.toContact.fullName}`;
}

/** Events with a future follow-up date, soonest first. */
export function getUpcomingFollowUps(events: TimelineEvent[]): TimelineEvent[] {
  const now = Date.now();
  return events
    .filter((e) => e.followUpDate && new Date(e.followUpDate).getTime() > now)
    .sort((a, b) => new Date(a.followUpDate!).getTime() - new Date(b.followUpDate!).getTime());
}

/** Current time as an ISO string, resolved once on the server and passed down
 * as data — keeps client components from calling `new Date()` in their render
 * body, which React's exhaustive-purity lint (correctly) flags. */
export function nowIso(): string {
  return new Date().toISOString();
}
