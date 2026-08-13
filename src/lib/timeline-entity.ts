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
