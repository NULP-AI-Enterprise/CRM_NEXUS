"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarClock, Loader2, Plus, User, Users } from "lucide-react";
import { format } from "date-fns";
import { uk, enUS } from "date-fns/locale";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/lib/i18n/context";
import { entityKey, entityLabel, type TimelineEntity, type TimelineEvent } from "@/lib/timeline-entity";

type RangeFilter = "week" | "month" | "all";

interface Lane {
  key: string;
  entity: TimelineEntity;
  label: string;
  events: TimelineEvent[];
}

function buildLanes(
  events: TimelineEvent[],
  range: RangeFilter,
  onlyEntityKey: string | undefined,
  emptyConnectionEntities: TimelineEntity[],
): Lane[] {
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

  // A connection with no events yet still needs a lane, otherwise there's no
  // "add event" action to ever log its first one.
  if (!onlyEntityKey) {
    for (const entity of emptyConnectionEntities) {
      const key = entityKey(entity);
      if (!map.has(key)) {
        map.set(key, { key, entity, label: entityLabel(entity), events: [] });
      }
    }
  }

  return Array.from(map.values());
}

export function TimelineView({
  events,
  emptyConnectionEntities = [],
  onlyEntityKey,
  showRangeControl = true,
}: {
  events: TimelineEvent[];
  emptyConnectionEntities?: TimelineEntity[];
  onlyEntityKey?: string;
  showRangeControl?: boolean;
}) {
  const { t } = useTranslation();
  const [range, setRange] = useState<RangeFilter>(onlyEntityKey ? "all" : "month");
  const [openAddFor, setOpenAddFor] = useState<string | null>(null);

  const lanes = useMemo(
    () => buildLanes(events, range, onlyEntityKey, emptyConnectionEntities),
    [events, range, onlyEntityKey, emptyConnectionEntities],
  );

  return (
    <div className="flex flex-col gap-4">
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

      {lanes.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("timelineView.empty")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {lanes.map((lane) => (
            <TimelineLane
              key={lane.key}
              lane={lane}
              isAddOpen={openAddFor === lane.key}
              onToggleAdd={() => setOpenAddFor(openAddFor === lane.key ? null : lane.key)}
              onSaved={() => setOpenAddFor(null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TimelineLane({
  lane,
  isAddOpen,
  onToggleAdd,
  onSaved,
}: {
  lane: Lane;
  isAddOpen: boolean;
  onToggleAdd: () => void;
  onSaved: () => void;
}) {
  const { t, locale } = useTranslation();
  const dateLocale = locale === "uk" ? uk : enUS;
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const upcoming = lane.events[0]?.followUpDate;
  const isConnection = lane.entity.kind === "connection";

  return (
    <div className="rounded-xl border border-border bg-card p-3.5 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {isConnection ? (
            <Users className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <User className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          {lane.entity.kind === "contact" ? (
            <Link
              href={`/contacts/${lane.entity.contact.id}`}
              className="text-xs font-semibold text-foreground hover:underline truncate"
            >
              {lane.entity.contact.fullName}
            </Link>
          ) : (
            <div className="flex items-center gap-1 text-xs font-semibold text-foreground truncate">
              <Link href={`/contacts/${lane.entity.fromContact.id}`} className="hover:underline">
                {lane.entity.fromContact.fullName}
              </Link>
              <span className="text-muted-foreground">↔</span>
              <Link href={`/contacts/${lane.entity.toContact.id}`} className="hover:underline">
                {lane.entity.toContact.fullName}
              </Link>
            </div>
          )}
          <span className="shrink-0 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground font-mono">
            {lane.events.length} {t("timelineView.eventsCount")}
          </span>
        </div>

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
      </div>

      {upcoming && (
        <div className="flex items-start gap-2 rounded-lg border border-dashed border-amber-400/50 bg-amber-400/10 px-2.5 py-2">
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
        <AddConnectionEventForm connectionId={lane.entity.connection.id} onSaved={onSaved} />
      )}

      <div className="flex flex-wrap gap-1.5">
        {lane.events.map((event) => {
          const isExpanded = expandedId === event.id;
          return (
            <button
              key={event.id}
              onClick={() => setExpandedId(isExpanded ? null : event.id)}
              className={`text-left rounded-lg border border-border p-2 text-xs transition-colors ${
                isExpanded ? "w-full bg-muted" : "max-w-[220px] bg-card hover:bg-muted"
              }`}
            >
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="font-mono">{format(new Date(event.createdAt), "d MMM", { locale: dateLocale })}</span>
                <span className="rounded bg-secondary px-1 py-0.1 text-secondary-foreground">
                  {t(`interactionType.${event.type}`)}
                </span>
              </div>
              <p className={`mt-0.5 text-foreground/90 ${isExpanded ? "whitespace-pre-wrap" : "truncate"}`}>
                {event.rawText}
              </p>
            </button>
          );
        })}
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
      <div className="flex justify-end gap-1.5">
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
