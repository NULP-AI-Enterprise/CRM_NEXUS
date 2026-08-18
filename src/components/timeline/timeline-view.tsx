"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarClock, GitBranch, Loader2, Plus, Search } from "lucide-react";
import { format } from "date-fns";
import { uk, enUS } from "date-fns/locale";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ClusterWorkflowDiagram } from "@/components/timeline/cluster-workflow-diagram";
import { BranchParentPicker } from "@/components/timeline/branch-parent-picker";
import { useTranslation } from "@/lib/i18n/context";
import { entityKey, entityLabel, type TimelineEntity, type TimelineEvent } from "@/lib/timeline-entity";
import { CATEGORY_COLORS, INTERACTION_KIND_STYLE } from "@/lib/contact-display";
import type { ContactCategory } from "@/generated/prisma/enums";

type RangeFilter = "week" | "month" | "all";

interface Lane {
  key: string;
  entity: TimelineEntity;
  label: string;
  events: TimelineEvent[];
}

function buildLanes(events: TimelineEvent[], range: RangeFilter, onlyEntityKey: string | undefined): Lane[] {
  const cutoff = (() => {
    if (range === "all") return null;
    const d = new Date();
    d.setDate(d.getDate() - (range === "week" ? 7 : 30));
    return d;
  })();
  const now = new Date();

  const map = new Map<string, Lane>();
  for (const event of events) {
    const key = entityKey(event.entity);
    if (onlyEntityKey && key !== onlyEntityKey) continue;

    const hasUpcomingFollowUp = event.followUpDate && new Date(event.followUpDate) >= now;
    if (cutoff && new Date(event.createdAt) < cutoff && !hasUpcomingFollowUp) continue;

    if (!map.has(key)) {
      map.set(key, { key, entity: event.entity, label: entityLabel(event.entity), events: [] });
    }
    map.get(key)!.events.push(event);
  }

  return Array.from(map.values());
}

interface LaneGroup {
  /** null for a trivial "cluster" — a lane whose contact(s) have no
   * ContactConnection to anyone else — which renders standalone, no header. */
  label: string | null;
  lanes: Lane[];
}

function laneMemberIds(entity: TimelineEntity): string[] {
  return entity.kind === "contact" ? [entity.contact.id] : [entity.fromContact.id, entity.toContact.id];
}

/** Groups lanes into clusters — connected components over the graph implied
 * by connection-lanes (an edge between their two contacts) — computed
 * entirely from lanes already built client-side, no extra fetch. A cluster's
 * label is auto-derived (its top-2 earliest-appearing members, by their
 * first event here), never stored — consistent with this app's existing
 * "clusters are computed on the fly, never persisted" rule. */
function groupLanesByCluster(lanes: Lane[]): LaneGroup[] {
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) && parent.get(root) !== root) root = parent.get(root)!;
    parent.set(id, root);
    return root;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  for (const lane of lanes) {
    const ids = laneMemberIds(lane.entity);
    for (const id of ids) if (!parent.has(id)) parent.set(id, id);
    if (ids.length === 2) union(ids[0]!, ids[1]!);
  }

  const rootToLanes = new Map<string, Lane[]>();
  for (const lane of lanes) {
    const root = find(laneMemberIds(lane.entity)[0]!);
    if (!rootToLanes.has(root)) rootToLanes.set(root, []);
    rootToLanes.get(root)!.push(lane);
  }

  const groups: LaneGroup[] = [];
  for (const groupLanes of rootToLanes.values()) {
    const memberIds = new Set<string>();
    for (const lane of groupLanes) for (const id of laneMemberIds(lane.entity)) memberIds.add(id);

    if (memberIds.size <= 1) {
      groups.push({ label: null, lanes: groupLanes });
      continue;
    }

    const nameById = new Map<string, string>();
    const firstSeenById = new Map<string, number>();
    for (const lane of groupLanes) {
      if (lane.entity.kind === "contact") {
        nameById.set(lane.entity.contact.id, lane.entity.contact.fullName);
      } else {
        nameById.set(lane.entity.fromContact.id, lane.entity.fromContact.fullName);
        nameById.set(lane.entity.toContact.id, lane.entity.toContact.fullName);
      }
      const ids = laneMemberIds(lane.entity);
      for (const event of lane.events) {
        const t = new Date(event.createdAt).getTime();
        for (const id of ids) {
          if (!firstSeenById.has(id) || t < firstSeenById.get(id)!) firstSeenById.set(id, t);
        }
      }
    }

    const label = Array.from(memberIds)
      .sort((a, b) => (firstSeenById.get(a) ?? Infinity) - (firstSeenById.get(b) ?? Infinity))
      .map((id) => nameById.get(id))
      .filter((name): name is string => Boolean(name))
      .slice(0, 2)
      .join(" & ");
    groups.push({ label, lanes: groupLanes });
  }

  return groups;
}

export function TimelineView({
  events,
  onlyEntityKey,
  showRangeControl = true,
}: {
  events: TimelineEvent[];
  onlyEntityKey?: string;
  showRangeControl?: boolean;
}) {
  const { t } = useTranslation();
  const [range, setRange] = useState<RangeFilter>(onlyEntityKey ? "all" : "month");
  const [openAddFor, setOpenAddFor] = useState<string | null>(null);
  const [clusterEntityKey, setClusterEntityKey] = useState<string | null>(null);
  const [clusterInitialEventId, setClusterInitialEventId] = useState<string | null>(null);
  const [clusterQuery, setClusterQuery] = useState("");

  const openCluster = (laneKey: string, eventId?: string) => {
    setClusterEntityKey(laneKey);
    setClusterInitialEventId(eventId ?? null);
  };

  const lanes = useMemo(() => buildLanes(events, range, onlyEntityKey), [events, range, onlyEntityKey]);

  // Grouping/search only make sense across multiple lanes — the single-entity
  // detail-page usage (`onlyEntityKey`) always has exactly one, so skip both.
  const groups = useMemo(() => (onlyEntityKey ? null : groupLanesByCluster(lanes)), [lanes, onlyEntityKey]);

  const visibleGroups = useMemo(() => {
    if (!groups) return null;
    const q = clusterQuery.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(
      (g) => (g.label && g.label.toLowerCase().includes(q)) || g.lanes.some((l) => l.label.toLowerCase().includes(q)),
    );
  }, [groups, clusterQuery]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {showRangeControl && (
          <div className="flex items-center gap-1 self-start rounded-lg border border-border bg-muted p-1">
            {(["week", "month", "all"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  range === r ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(r === "week" ? "timelineView.rangeWeek" : r === "month" ? "timelineView.rangeMonth" : "timelineView.rangeAll")}
              </button>
            ))}
          </div>
        )}
        {visibleGroups && (
          <div className="relative w-56 max-w-full">
            <Search className="absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={clusterQuery}
              onChange={(e) => setClusterQuery(e.target.value)}
              placeholder={t("timelineView.clusterSearch")}
              className="h-7 border-border bg-muted pl-7 text-xs"
            />
          </div>
        )}
      </div>

      {lanes.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("timelineView.empty")}</p>
      ) : visibleGroups ? (
        visibleGroups.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("filters.empty")}</p>
        ) : (
          <div className="flex flex-col gap-4">
            {visibleGroups.map((group, i) => (
              <div key={group.lanes[0]?.key ?? i} className="flex flex-col gap-2.5">
                {group.label && (
                  <div className="flex items-center gap-2 px-0.5">
                    <GitBranch className="size-3 text-muted-foreground" />
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {group.label}
                    </span>
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                      {group.lanes.length}
                    </span>
                  </div>
                )}
                <div className="flex flex-col gap-3">
                  {group.lanes.map((lane) => (
                    <TimelineLane
                      key={lane.key}
                      lane={lane}
                      isAddOpen={openAddFor === lane.key}
                      onToggleAdd={() => setOpenAddFor(openAddFor === lane.key ? null : lane.key)}
                      onSaved={() => setOpenAddFor(null)}
                      onOpenCluster={(eventId) => openCluster(lane.key, eventId)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="flex flex-col gap-3">
          {lanes.map((lane) => (
            <TimelineLane
              key={lane.key}
              lane={lane}
              isAddOpen={openAddFor === lane.key}
              onToggleAdd={() => setOpenAddFor(openAddFor === lane.key ? null : lane.key)}
              onSaved={() => setOpenAddFor(null)}
              onOpenCluster={() => setClusterEntityKey(lane.key)}
            />
          ))}
        </div>
      )}

      <ClusterWorkflowDiagram
        open={clusterEntityKey != null}
        onOpenChange={(open) => !open && setClusterEntityKey(null)}
        entityKey={clusterEntityKey}
        initialEventId={clusterInitialEventId}
      />
    </div>
  );
}

function participantDots(entity: TimelineEntity): Array<{ id: string; color: string }> {
  if (entity.kind === "contact") {
    return [{ id: entity.contact.id, color: CATEGORY_COLORS[entity.contact.category as ContactCategory]?.dot ?? CATEGORY_COLORS.OTHER.dot }];
  }
  return [
    { id: entity.fromContact.id, color: CATEGORY_COLORS.OTHER.dot },
    { id: entity.toContact.id, color: CATEGORY_COLORS.OTHER.dot },
  ];
}

function TimelineLane({
  lane,
  isAddOpen,
  onToggleAdd,
  onSaved,
  onOpenCluster,
}: {
  lane: Lane;
  isAddOpen: boolean;
  onToggleAdd: () => void;
  onSaved: () => void;
  onOpenCluster: (eventId?: string) => void;
}) {
  const { t, locale } = useTranslation();
  const dateLocale = locale === "uk" ? uk : enUS;

  const upcoming = lane.events[0]?.followUpDate;
  const isConnection = lane.entity.kind === "connection";
  const dots = participantDots(lane.entity);
  // Weave colors a cluster card by its event's *kind* — we use the most
  // recent event's type as the lane's representative accent.
  const accentColor = lane.events[0] ? INTERACTION_KIND_STYLE[lane.events[0].type].color : "var(--border)";

  return (
    <div className="rounded-[11px] border border-border bg-card px-[11px] py-[10px]" style={{ borderLeftWidth: "3px", borderLeftColor: accentColor }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-semibold leading-[1.3] text-foreground">
            {lane.entity.kind === "contact" ? (
              <Link href={`/contacts/${lane.entity.contact.id}`} className="truncate hover:underline">
                {lane.entity.contact.fullName}
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 truncate">
                <Link href={`/contacts/${lane.entity.fromContact.id}`} className="hover:underline">
                  {lane.entity.fromContact.fullName}
                </Link>
                <span className="text-muted-foreground">↔</span>
                <Link href={`/contacts/${lane.entity.toContact.id}`} className="hover:underline">
                  {lane.entity.toContact.fullName}
                </Link>
              </span>
            )}
          </div>
          <div className="mt-[5px] flex items-center gap-[6px] font-mono text-[9.5px] text-muted-foreground">
            <span>
              {lane.events.length} {t("timelineView.eventsCount")}
            </span>
            {dots.length > 0 && (
              <>
                <span>·</span>
                <span className="flex items-center gap-[3px]">
                  {dots.map((d, i) => (
                    <span key={`${d.id}-${i}`} className="size-[7px] rounded-full" style={{ backgroundColor: d.color }} />
                  ))}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {isConnection && (
            <Button
              size="sm"
              variant="outline"
              onClick={onToggleAdd}
              className="h-6.5 shrink-0 border-border bg-card text-[11px] text-muted-foreground hover:text-foreground gap-1"
            >
              <Plus className="size-3" />
              {t("timelineView.addEvent")}
            </Button>
          )}
          <button
            onClick={() => onOpenCluster()}
            title={t("timelineView.openCluster")}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <GitBranch className="size-3.5" />
          </button>
        </div>
      </div>

      {upcoming && (
        <div className="mt-[9px] flex items-start gap-2 rounded-lg border border-dashed border-amber-400/50 bg-amber-400/10 px-2.5 py-2">
          <CalendarClock className="mt-0.5 size-3 shrink-0 text-amber-700" />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">
              {t("timeline.upcoming")} · {format(new Date(upcoming), "d MMM", { locale: dateLocale })}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-amber-900/90">{lane.events[0]?.followUp}</p>
          </div>
        </div>
      )}

      {isAddOpen && lane.entity.kind === "connection" && (
        <div className="mt-[9px]">
          <AddConnectionEventForm connectionId={lane.entity.connection.id} onSaved={onSaved} />
        </div>
      )}

      {/* Vertical interaction log — a colored ring dot per event, connected by
          a thin line, matching Weave's exact detail-page log anatomy. */}
      <div className="mt-[9px] flex flex-col">
        {lane.events.map((event, i) => (
          <button key={event.id} onClick={() => onOpenCluster(event.id)} className="flex w-full gap-3 text-left">
            <div className="flex w-[18px] shrink-0 flex-col items-center">
              <span
                className="mt-[3px] size-[10px] shrink-0 rounded-full bg-card"
                style={{ border: `2.5px solid ${INTERACTION_KIND_STYLE[event.type].color}` }}
              />
              {i < lane.events.length - 1 && <span className="mt-[1px] w-[1.5px] flex-1 bg-border" />}
            </div>
            <div className="min-w-0 flex-1 pb-[15px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12.5px] font-semibold text-foreground">{t(`interactionType.${event.type}`)}</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {format(new Date(event.createdAt), "d MMM", { locale: dateLocale })}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-[1.5] text-foreground/90">{event.rawText}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function AddConnectionEventForm({ connectionId, onSaved }: { connectionId: string; onSaved: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [rawText, setRawText] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [parentInteractionId, setParentInteractionId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    if (!rawText.trim()) return;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/connections/${connectionId}/interactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rawText: rawText.trim(),
            followUp: followUp.trim() || null,
            followUpDate: followUpDate || null,
            parentInteractionId,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? t("timelineView.saveError"));
        }
        toast.success(t("timelineView.saved"));
        setRawText("");
        setFollowUp("");
        setFollowUpDate("");
        setParentInteractionId(null);
        onSaved();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("timelineView.saveError"));
      }
    });
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted p-2.5">
      <Textarea
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        placeholder={t("timelineView.addEventPlaceholder")}
        className="min-h-14 resize-none bg-card border-border text-base md:text-xs"
        disabled={isPending}
        autoFocus
      />
      <div className="flex gap-2">
        <Input
          value={followUp}
          onChange={(e) => setFollowUp(e.target.value)}
          placeholder={t("timeline.upcoming")}
          className="bg-card border-border text-base md:text-xs h-7 flex-1"
          disabled={isPending}
        />
        <input
          type="date"
          value={followUpDate}
          onChange={(e) => setFollowUpDate(e.target.value)}
          className="rounded-md border border-border bg-card px-2 text-xs text-foreground h-7"
          disabled={isPending}
        />
      </div>
      <div className="flex items-center justify-between gap-1.5">
        <BranchParentPicker value={parentInteractionId} onChange={setParentInteractionId} />
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={isPending || !rawText.trim()}
          className="h-6.5 bg-primary hover:bg-primary/90 text-primary-foreground text-[11px] gap-1"
        >
          {isPending && <Loader2 className="size-3 animate-spin" />}
          {t("timelineView.save")}
        </Button>
      </div>
    </div>
  );
}
