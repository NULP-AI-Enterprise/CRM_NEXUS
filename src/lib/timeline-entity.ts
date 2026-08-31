import type { InteractionType } from "@/generated/prisma/enums";

export type TimelineEntity =
  | { kind: "contact"; contact: { id: string; fullName: string; category: string } }
  | {
      kind: "connection";
      connection: { id: string; relationship: string | null };
      fromContact: { id: string; fullName: string };
      toContact: { id: string; fullName: string };
    }
  | { kind: "company"; company: { id: string; name: string } }
  | { kind: "community"; community: { id: string; name: string } };

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

/** The subset of `TimelineEntity` that can appear inside a cluster diagram's
 * own event set. A cluster is built purely by BFS-walking Contact/
 * ContactConnection edges (see `getClusterDiagramData`), so a Company or
 * Community entity never occurs there — narrowing the *type*, not just the
 * runtime data, lets cluster-diagram code exhaustively switch on "contact"
 * vs "connection" without a company/community case that can never execute. */
export type ClusterEntity = Extract<TimelineEntity, { kind: "contact" } | { kind: "connection" }>;

export interface ClusterEvent extends Omit<TimelineEvent, "entity"> {
  entity: ClusterEntity;
}

/** Stable per-entity key for grouping events into timeline lanes. */
export function entityKey(entity: TimelineEntity): string {
  switch (entity.kind) {
    case "contact":
      return `contact:${entity.contact.id}`;
    case "connection":
      return `connection:${entity.connection.id}`;
    case "company":
      return `company:${entity.company.id}`;
    case "community":
      return `community:${entity.community.id}`;
  }
}

/** Human label for an entity's lane. */
export function entityLabel(entity: TimelineEntity): string {
  switch (entity.kind) {
    case "contact":
      return entity.contact.fullName;
    case "connection":
      return `${entity.fromContact.fullName} ↔ ${entity.toContact.fullName}`;
    case "company":
      return entity.company.name;
    case "community":
      return entity.community.name;
  }
}

/** The `POST .../interactions` route that owns creation for a given
 * `entityKey()` string — the one place that maps a lane's entity to where a
 * new note against it should be sent, so every caller (the account-wide
 * Timeline canvas, the per-contact branch diagram) targets the same URL for
 * the same kind of entity instead of each re-deriving it. */
export function interactionCreateUrl(entityKeyStr: string): string {
  const [kind, id] = entityKeyStr.split(":");
  switch (kind) {
    case "contact":
      return `/api/contacts/${id}/interactions`;
    case "connection":
      return `/api/connections/${id}/interactions`;
    case "company":
      return `/api/companies/${id}/interactions`;
    case "community":
      return `/api/communities/${id}/interactions`;
    default:
      throw new Error(`Unknown entity key: ${entityKeyStr}`);
  }
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
