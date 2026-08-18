import type { ContactCategory } from "@/generated/prisma/enums";
import type { EntityCounts } from "@/lib/data/counts";
import type { FullGraphData } from "@/lib/data/graph";
import { entityKey, entityLabel, type TimelineEvent } from "@/lib/timeline-entity";

const NEEDS_ATTENTION_MIN_SCORE = 8;
const STALE_AFTER_DAYS = 30;
const LATEST_INTERACTIONS_LIMIT = 5;
const MOST_ACTIVE_LIMIT = 5;
const NEEDS_ATTENTION_LIMIT = 5;
const SPARKLINE_DAYS = 14;

export interface NeedsAttentionContact {
  id: string;
  name: string;
  category: ContactCategory;
  usefulnessScore: number | null;
  lastInteractionAt: string | null;
}

export interface RelationshipActivity {
  key: string;
  label: string;
  count: number;
}

export interface DashboardSummary {
  today: string;
  entitiesTracked: number;
  relationshipsCount: number;
  categoryCounts: Record<ContactCategory, number>;
  interactionsCount: number;
  interactionsByDay: number[];
  needsAttention: NeedsAttentionContact[];
  latestInteractions: TimelineEvent[];
  mostActiveRelationships: RelationshipActivity[];
}

function isStale(lastInteractionAt: string | null, now: number): boolean {
  if (!lastInteractionAt) return true;
  const ageDays = (now - new Date(lastInteractionAt).getTime()) / (1000 * 60 * 60 * 24);
  return ageDays >= STALE_AFTER_DAYS;
}

function bucketByDay(events: TimelineEvent[], now: number): number[] {
  const buckets = new Array(SPARKLINE_DAYS).fill(0);
  const dayMs = 1000 * 60 * 60 * 24;
  const todayStart = Math.floor(now / dayMs) * dayMs;

  for (const event of events) {
    const eventDayStart = Math.floor(new Date(event.createdAt).getTime() / dayMs) * dayMs;
    const daysAgo = Math.round((todayStart - eventDayStart) / dayMs);
    const index = SPARKLINE_DAYS - 1 - daysAgo;
    if (index >= 0 && index < SPARKLINE_DAYS) {
      buckets[index]++;
    }
  }

  return buckets;
}

export function computeDashboardSummary(
  counts: EntityCounts,
  graphData: FullGraphData,
  timelineEvents: TimelineEvent[],
): DashboardSummary {
  const now = Date.now();

  const needsAttention: NeedsAttentionContact[] = graphData.nodes
    .filter((n) => n.nodeType === "contact")
    .filter((n) => n.category === "VIP" || (n.usefulnessScore ?? 0) >= NEEDS_ATTENTION_MIN_SCORE)
    .filter((n) => isStale(n.lastInteractionAt, now))
    .sort((a, b) => new Date(a.lastInteractionAt ?? 0).getTime() - new Date(b.lastInteractionAt ?? 0).getTime())
    .slice(0, NEEDS_ATTENTION_LIMIT)
    .map((n) => ({
      id: n.id,
      name: n.name,
      category: n.category,
      usefulnessScore: n.usefulnessScore,
      lastInteractionAt: n.lastInteractionAt,
    }));

  const activityByKey = new Map<string, RelationshipActivity>();
  for (const event of timelineEvents) {
    const key = entityKey(event.entity);
    const existing = activityByKey.get(key);
    if (existing) {
      existing.count++;
    } else {
      activityByKey.set(key, { key, label: entityLabel(event.entity), count: 1 });
    }
  }
  const mostActiveRelationships = Array.from(activityByKey.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, MOST_ACTIVE_LIMIT);

  return {
    today: new Date(now).toISOString(),
    entitiesTracked: counts.contacts + counts.companies + counts.communities,
    relationshipsCount: graphData.links.length,
    categoryCounts: graphData.stats.categoryCounts,
    interactionsCount: timelineEvents.length,
    interactionsByDay: bucketByDay(timelineEvents, now),
    needsAttention,
    latestInteractions: timelineEvents.slice(0, LATEST_INTERACTIONS_LIMIT),
    mostActiveRelationships,
  };
}
