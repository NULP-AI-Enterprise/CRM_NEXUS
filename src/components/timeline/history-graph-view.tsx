"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CalendarDays, GitBranch, History, LayoutGrid, Loader2, PanelRight, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { uk, enUS } from "date-fns/locale";
import { toast } from "sonner";

import { ClusterWorkflowDiagram } from "@/components/timeline/cluster-workflow-diagram";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "@/lib/i18n/context";
import { entityKey, entityLabel, interactionCreateUrl, type TimelineEvent } from "@/lib/timeline-entity";
import { CATEGORY_COLORS, INTERACTION_KIND_STYLE } from "@/lib/contact-display";
import { partitionIntoComponents } from "@/lib/graph/connected-components";
import type { ConnectionWithNames } from "@/lib/data/connections";
import type { ContactCategory, InteractionType } from "@/generated/prisma/enums";

const KIND_STYLE = INTERACTION_KIND_STYLE;

const ME_ID = "__me";
const DAY_MS = 86400000;
/** Minimum forward slack past "today" the default view must show — without
 * this, "now" sits pinned to the window's right edge with zero room to see
 * what's coming up (follow-ups, scheduled things), which reads as the graph
 * having simply stopped rather than as "you are here." */
const FORWARD_MARGIN_DAYS = 5;
type Scale = "day" | "week" | "month" | "year";
const SPANS: Record<Scale, number> = { day: 14, week: 70, month: 210, year: 460 };
const SCALES: Scale[] = ["day", "week", "month", "year"];
/** Per-character width estimates for the card's two text lines — used to size
 * the card to its own content instead of floating a caption above a
 * fixed-width shape. A floated caption was the actual cause of two cards
 * overlapping without their bodies ever touching: the lane-packing math only
 * ever compared body widths, and text drawn outside that box was invisible
 * to it. Folding the text into the card's own measured width fixes this at
 * the source rather than patching the collision check separately. */
const TITLE_CHAR_W = 6.4;
const META_CHAR_W = 5.4;
const CARD_PAD_X = 10;
const CARD_MIN_W = 132;
const CARD_MAX_W = 208;

function estimateTextWidth(text: string, perChar: number): number {
  return text.length * perChar;
}

function truncateToWidth(text: string, maxWidth: number, perChar: number): string {
  const maxChars = Math.max(3, Math.floor(maxWidth / perChar));
  return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
}

/** Optional follow-up (date + short note) shared by both create composers —
 * collapsed to a single toggle link by default so setting one stays a
 * deliberate extra step, not a field everyone has to skip past. */
export function FollowUpFields({
  enabled,
  onToggle,
  date,
  onDateChange,
  text,
  onTextChange,
  disabled,
}: {
  enabled: boolean;
  onToggle: () => void;
  date: string;
  onDateChange: (v: string) => void;
  text: string;
  onTextChange: (v: string) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  if (!enabled) {
    return (
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className="flex w-fit cursor-pointer items-center gap-1.5 rounded-[8px] border px-[10px] py-[7px] hover:bg-[#FBFBF9]"
        style={{ borderColor: "#ECEBE7", color: "#3A3C42", fontSize: 11.5, fontWeight: 600, background: "none" }}
      >
        <CalendarClock className="size-3" />
        {t("historyGraph.addFollowUp")}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="date"
        value={date}
        onChange={(e) => onDateChange(e.target.value)}
        disabled={disabled}
        className="h-7 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <input
        type="text"
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder={t("historyGraph.followUpDatePlaceholder")}
        disabled={disabled}
        className="h-7 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-label={t("cluster.expand.cancel")}
        className="flex size-6 shrink-0 items-center justify-center rounded hover:bg-[#F6F6F4]"
        style={{ color: "#A6A6A0", cursor: "pointer", background: "none", border: "none" }}
      >
        ✕
      </button>
    </div>
  );
}

interface Participant {
  id: string;
  name: string;
  color: string;
  isMe: boolean;
  category: ContactCategory | null;
}

interface HistoryEvent {
  id: string;
  date: Date;
  kind: InteractionType;
  rawText: string;
  followUp: string | null;
  followUpDate: string | null;
  entityKeyStr: string;
  entityLabelStr: string;
  parentInteractionId: string | null;
  participants: Participant[];
}

function buildHistoryEvents(events: TimelineEvent[], meLabel: string): HistoryEvent[] {
  const out: HistoryEvent[] = events.map((e) => {
    let participants: Participant[];
    switch (e.entity.kind) {
      case "contact":
        participants = [
          { id: ME_ID, name: meLabel, color: "var(--primary)", isMe: true, category: null },
          {
            id: e.entity.contact.id,
            name: e.entity.contact.fullName,
            color: CATEGORY_COLORS[e.entity.contact.category as ContactCategory]?.dot ?? CATEGORY_COLORS.OTHER.dot,
            isMe: false,
            category: e.entity.contact.category as ContactCategory,
          },
        ];
        break;
      case "connection":
        participants = [
          { id: e.entity.fromContact.id, name: e.entity.fromContact.fullName, color: CATEGORY_COLORS.OTHER.dot, isMe: false, category: null },
          { id: e.entity.toContact.id, name: e.entity.toContact.fullName, color: CATEGORY_COLORS.OTHER.dot, isMe: false, category: null },
        ];
        break;
      // Company/community events aren't attached to any specific person — a
      // single participant standing for the org itself, never "me" (I wasn't
      // personally the party to it the way a contact-kind event's isMe is).
      case "company":
        participants = [{ id: e.entity.company.id, name: e.entity.company.name, color: CATEGORY_COLORS.OTHER.dot, isMe: false, category: null }];
        break;
      case "community":
        participants = [{ id: e.entity.community.id, name: e.entity.community.name, color: CATEGORY_COLORS.OTHER.dot, isMe: false, category: null }];
        break;
    }
    return {
      id: e.id,
      date: new Date(e.createdAt),
      kind: e.type,
      rawText: e.rawText,
      followUp: e.followUp,
      followUpDate: e.followUpDate,
      entityKeyStr: entityKey(e.entity),
      entityLabelStr: entityLabel(e.entity),
      parentInteractionId: e.parentInteractionId,
      participants,
    };
  });
  // Weave's own D.events is chronologically ascending (oldest first) — match
  // that convention so the packing/scrubber math below ports 1:1.
  out.sort((a, b) => a.date.getTime() - b.date.getTime());
  return out;
}

interface BlobShape {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  tint: string;
  color: string;
  sw: number;
  title: string;
  metaLine: string;
  isDirect: boolean;
  hasChildren: boolean;
  onSelect: () => void;
}

interface FutureMarkerShape {
  eventId: string;
  anchorX: number;
  x: number;
  y: number;
  color: string;
  followUp: string | null;
  followUpDate: string | null;
  onSelect: () => void;
}

export function HistoryGraphView({
  events,
  connections,
  nowIso,
  pinnedEntities = [],
}: {
  events: TimelineEvent[];
  connections: ConnectionWithNames[];
  nowIso: string;
  /** Entities that must be choosable in "+ New entry" even if they have no
   * events yet (e.g. an org's own log, or a member who hasn't been noted
   * about before) — the option list is otherwise derived purely from events
   * actually present, which would silently omit anyone with zero history. */
  pinnedEntities?: Array<{ key: string; label: string }>;
}) {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const dateLocale = locale === "uk" ? uk : enUS;
  const meLabel = t("cluster.me");

  const [scale, setScale] = useState<Scale>("month");
  // Canvas: see shape/density of a long history at a glance. Agenda: a plain
  // day-by-day list — unambiguous chronological order, no positioning to get
  // wrong, closer to "day/week agenda" than the canvas is by design.
  const [viewMode, setViewMode] = useState<"canvas" | "agenda">("canvas");
  const [tOffset, setTOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [workflowOpen, setWorkflowOpen] = useState(false);
  // Graphical CRUD on the selected event's detail panel — create/delete/
  // reschedule, so the canvas isn't purely read-only for any entity kind.
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [editDate, setEditDate] = useState("");
  const [editType, setEditType] = useState<InteractionType>("MEMO");
  const [isSavingDate, setIsSavingDate] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteType, setNoteType] = useState<InteractionType>("MEMO");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteFollowUpOn, setNoteFollowUpOn] = useState(false);
  const [noteFollowUpDate, setNoteFollowUpDate] = useState("");
  const [noteFollowUpText, setNoteFollowUpText] = useState("");
  // A root-level (no selection needed) entry against a chosen entity — the
  // per-event "+ Add note" above requires first finding and selecting one of
  // that entity's existing cards, which silently breaks for a first-ever note
  // and is easy to lose track of ("which card is actually selected?").
  const [isAddingRootEntry, setIsAddingRootEntry] = useState(false);
  const [newEntryKey, setNewEntryKey] = useState("");
  const [newEntryText, setNewEntryText] = useState("");
  const [newEntryType, setNewEntryType] = useState<InteractionType>("MEMO");
  const [isSavingRootEntry, setIsSavingRootEntry] = useState(false);
  const [newEntryFollowUpOn, setNewEntryFollowUpOn] = useState(false);
  const [newEntryFollowUpDate, setNewEntryFollowUpDate] = useState("");
  const [newEntryFollowUpText, setNewEntryFollowUpText] = useState("");
  // Three width regimes, because the columns have real minimum sizes and the
  // app sidebar already spends 240px of the viewport:
  //   < 768            one pane at a time, chosen here (no room for two).
  //   768 … 1299       list + chart; the detail panel overlays the chart.
  //   >= 1300          all three side by side (240 + chart + 314 fits).
  // The previous build let the row overflow horizontally instead, which put a
  // dead band at 1024-1180 where the panel simply sat off-screen.
  const [mobilePane, setMobilePane] = useState<"list" | "chart" | "detail">("chart");
  /** Only consulted in the middle regime, where the panel is an overlay and so
   * has to be dismissable; at >= 1300 the panel is a static column and this is
   * ignored. */
  const [detailOpen, setDetailOpen] = useState(false);

  /** Select an event and bring its details into view in whichever regime we're
   * in — a tap that visibly does nothing reads as a broken control. Also
   * resets any open edit-date/add-note composer: the panel's DOM node
   * persists across selections (it isn't keyed by event id), so without this
   * an open composer would leak its state onto whichever event gets selected
   * next. */
  const pickEvent = useCallback((id: string | null) => {
    setSelectedId(id);
    setDetailOpen(id !== null);
    if (id !== null) setMobilePane("detail");
    setIsEditingDate(false);
    setIsAddingNote(false);
    setNoteText("");
    setNoteType("MEMO");
    setNoteFollowUpOn(false);
    setNoteFollowUpDate("");
    setNoteFollowUpText("");
  }, []);
  const [size, setSize] = useState({ width: 900, height: 480 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // Measure the canvas before paint, then keep it in sync. The explicit
  // measure() on mount is not redundant with the observer: ResizeObserver's
  // initial callback is not guaranteed to be delivered in every engine, and
  // when it isn't, every position below silently falls back to the useState
  // defaults — shapes then get laid out for a canvas size that doesn't exist
  // and spill past the real edges. Reads happen in a layout effect (before
  // paint, so there's no flash) and the setter no-ops on an unchanged size,
  // so this can't loop.
  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      setSize((prev) => (Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - height) < 0.5 ? prev : { width, height }));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Seeded from the server-computed nowIso (so the first render matches SSR,
  // no hydration mismatch) but refreshed periodically after mount — without
  // this, a tab left open for hours keeps treating an increasingly stale
  // "now" as today, drifting the default window and the "Today" line away
  // from the real date. Day-level precision is all this view needs, so a
  // 5-minute interval is plenty.
  const [liveNowMs, setLiveNowMs] = useState(() => new Date(nowIso).getTime());
  useEffect(() => {
    const id = setInterval(() => setLiveNowMs(Date.now()), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);
  const nowMs = liveNowMs;
  const now = useMemo(() => new Date(nowMs), [nowMs]);
  // The default (tOffset=0) view anchors here instead of at "now" itself, so
  // there's always at least FORWARD_MARGIN_DAYS of headroom past today —
  // panning/zooming/scrubbing all key off this same anchor so they stay
  // consistent with the shifted default.
  const anchorMs = nowMs + FORWARD_MARGIN_DAYS * DAY_MS;
  const allEvents = useMemo(() => buildHistoryEvents(events, meLabel), [events, meLabel]);

  // Every contact reachable from another via a real ContactConnection, or via
  // a parentInteractionId chain crossing entities (e.g. "X introduces Y" then
  // Y's own event), collapses into one cluster key — this is what makes a
  // timeline "line" mean one connected thread of people, not just whichever
  // events happen to fit the same pixel column. ME_ID is deliberately never
  // part of the edge set: every contact-kind event includes it as a
  // participant, so unioning through it would merge the entire account into
  // a single cluster — exactly the bug this is fixing.
  const eventClusterKey = useMemo(() => {
    const byId = new Map(allEvents.map((e) => [e.id, e]));
    const contactIdsOf = (e: HistoryEvent) => e.participants.filter((p) => !p.isMe).map((p) => p.id);

    const edges: Array<[string, string]> = connections.map((c) => [c.fromContactId, c.toContactId]);
    for (const e of allEvents) {
      const ids = contactIdsOf(e);
      if (ids.length === 2) edges.push([ids[0]!, ids[1]!]);
      const parent = e.parentInteractionId ? byId.get(e.parentInteractionId) : undefined;
      if (parent) for (const a of ids) for (const b of contactIdsOf(parent)) edges.push([a, b]);
    }

    const rootOf = partitionIntoComponents(edges);
    const out = new Map<string, string>();
    for (const e of allEvents) {
      const first = contactIdsOf(e)[0];
      out.set(e.id, first ? (rootOf.get(first) ?? first) : e.id);
    }
    return out;
  }, [allEvents, connections]);

  const spanDays = SPANS[scale];
  const endMs = anchorMs - tOffset * spanDays * 0.5 * DAY_MS;
  const startMs = endMs - spanDays * DAY_MS;
  const end = new Date(endMs);
  const start = new Date(startMs);
  const W = size.width;
  const H = size.height;

  const xOf = useCallback((d: Date) => 72 + ((d.getTime() - startMs) / (endMs - startMs)) * (W - 150), [startMs, endMs, W]);

  const q = query.trim().toLowerCase();
  const matches = useCallback(
    (ev: HistoryEvent) => !q || ev.rawText.toLowerCase().includes(q) || ev.participants.some((p) => p.name.toLowerCase().includes(q)),
    [q],
  );

  const selectedEvent = useMemo(() => {
    if (selectedId) return allEvents.find((e) => e.id === selectedId) ?? null;
    return allEvents.length > 0 ? allEvents[allEvents.length - 1]! : null;
  }, [selectedId, allEvents]);
  const parentEvent = useMemo(
    () => (selectedEvent?.parentInteractionId ? allEvents.find((e) => e.id === selectedEvent.parentInteractionId) ?? null : null),
    [selectedEvent, allEvents],
  );

  // Any real ContactConnection touching either of this event's two parties —
  // Weave's own "touched relationships" section, which the account-wide
  // connections list makes possible here without a per-event fetch.
  const touchedRelationships = useMemo(() => {
    if (!selectedEvent) return [];
    const partyIds = new Set(selectedEvent.participants.filter((p) => !p.isMe).map((p) => p.id));
    return connections.filter((c) => partyIds.has(c.fromContactId) || partyIds.has(c.toContactId));
  }, [selectedEvent, connections]);

  const handleDeleteSelected = async () => {
    if (!selectedEvent) return;
    try {
      const res = await fetch(`/api/interactions/${selectedEvent.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      pickEvent(null);
      router.refresh();
    } catch {
      toast.error(t("cluster.expand.deleteError"));
    }
  };

  const startEditingDate = () => {
    if (!selectedEvent) return;
    // format() renders in local time by default (unlike toISOString, which is
    // UTC) — the same "yyyy-MM-dd" source cluster-workflow-diagram.tsx uses
    // to seed its own date input.
    setEditDate(format(selectedEvent.date, "yyyy-MM-dd"));
    setEditType(selectedEvent.kind);
    setIsEditingDate(true);
  };

  const handleSaveDate = async () => {
    if (!selectedEvent || !editDate) return;
    setIsSavingDate(true);
    try {
      // editDate is a bare "yyyy-MM-dd" from <input type="date">. Parse the
      // components as local time (not the Date constructor's UTC-midnight
      // parse) — same fix already established in cluster-workflow-diagram.tsx
      // and org-interaction-section.tsx.
      const [y, m, d] = editDate.split("-").map(Number);
      if (!y || !m || !d) throw new Error();
      const createdAt = new Date(y, m - 1, d).toISOString();
      const res = await fetch(`/api/interactions/${selectedEvent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createdAt, type: editType }),
      });
      if (!res.ok) throw new Error();
      setIsEditingDate(false);
      router.refresh();
    } catch {
      toast.error(t("cluster.expand.saveError"));
    } finally {
      setIsSavingDate(false);
    }
  };

  const handleAddNote = async () => {
    const rawText = noteText.trim();
    if (!selectedEvent || !rawText) return;
    setIsSavingNote(true);
    try {
      const res = await fetch(interactionCreateUrl(selectedEvent.entityKeyStr), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText,
          type: noteType,
          parentInteractionId: selectedEvent.id,
          followUpDate: noteFollowUpOn && noteFollowUpDate ? noteFollowUpDate : undefined,
          followUp: noteFollowUpOn && noteFollowUpText.trim() ? noteFollowUpText.trim() : undefined,
        }),
      });
      if (!res.ok) throw new Error();
      const { interaction } = (await res.json()) as { interaction: { id: string } };
      setNoteText("");
      setNoteType("MEMO");
      setNoteFollowUpOn(false);
      setNoteFollowUpDate("");
      setNoteFollowUpText("");
      pickEvent(interaction.id);
      router.refresh();
    } catch {
      toast.error(t("cluster.expand.saveError"));
    } finally {
      setIsSavingNote(false);
    }
  };

  // Choosable targets for "+ New entry" — every entity with at least one
  // event already in view, plus whatever the caller pins (an org's own log,
  // or a member who hasn't been noted about yet), deduped by key.
  const entityOptions = useMemo(() => {
    const byKey = new Map<string, string>();
    for (const p of pinnedEntities) byKey.set(p.key, p.label);
    for (const ev of allEvents) if (!byKey.has(ev.entityKeyStr)) byKey.set(ev.entityKeyStr, ev.entityLabelStr);
    return Array.from(byKey, ([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [pinnedEntities, allEvents]);

  const startAddingRootEntry = () => {
    // Defaults to the caller's own first pinned entity (the org itself, on
    // an embedded company/community view) rather than whichever option
    // happens to sort first alphabetically — that's the intent someone
    // opening "+ New entry" from this page almost always has.
    setNewEntryKey((k) => k || pinnedEntities[0]?.key || entityOptions[0]?.key || "");
    setIsAddingRootEntry(true);
  };

  const handleAddRootEntry = async () => {
    const rawText = newEntryText.trim();
    if (!rawText || !newEntryKey) return;
    setIsSavingRootEntry(true);
    try {
      const res = await fetch(interactionCreateUrl(newEntryKey), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText,
          type: newEntryType,
          parentInteractionId: null,
          followUpDate: newEntryFollowUpOn && newEntryFollowUpDate ? newEntryFollowUpDate : undefined,
          followUp: newEntryFollowUpOn && newEntryFollowUpText.trim() ? newEntryFollowUpText.trim() : undefined,
        }),
      });
      if (!res.ok) throw new Error();
      const { interaction } = (await res.json()) as { interaction: { id: string } };
      setNewEntryText("");
      setIsAddingRootEntry(false);
      setNewEntryType("MEMO");
      setNewEntryFollowUpOn(false);
      setNewEntryFollowUpDate("");
      setNewEntryFollowUpText("");
      pickEvent(interaction.id);
      router.refresh();
    } catch {
      toast.error(t("cluster.expand.saveError"));
    } finally {
      setIsSavingRootEntry(false);
    }
  };

  const axisTicks = useMemo(() => {
    // Tick count follows the width. The reference design's fixed 6 assumes a
    // desktop pane; on a phone that many date labels collide into one unreadable
    // smear, so drop to 3 (and 4 at tablet width) where there isn't room.
    const ticks = W < 480 ? 3 : W < 760 ? 4 : 6;
    return Array.from({ length: ticks + 1 }, (_, i) => {
      const dt = new Date(startMs + ((endMs - startMs) * i) / ticks);
      const label =
        scale === "day" ? format(dt, "d MMM yy", { locale: dateLocale }) : scale === "year" ? format(dt, "MMM yy", { locale: dateLocale }) : format(dt, "d MMM", { locale: dateLocale });
      return { x: Math.round(xOf(dt)), label };
    });
  }, [startMs, endMs, scale, dateLocale, xOf, W]);

  // Events that are someone else's parent — surfaced as a small badge on the
  // canvas itself, so "this has branches" is visible while just browsing,
  // not only after opening the detail panel.
  const parentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const ev of allEvents) if (ev.parentInteractionId) ids.add(ev.parentInteractionId);
    return ids;
  }, [allEvents]);

  const { blobs, contentH, canvasW, futureMarkers } = useMemo(() => {
    const inWindow = allEvents.filter((ev) => {
      const evMs = ev.date.getTime();
      return evMs >= startMs && evMs <= endMs && matches(ev);
    });

    const BLOB_H = 76;
    const GAP = 12;
    const TOP_OFFSET = 74;
    const BOTTOM_MARGIN = 14;
    // A card's x position is always its true date — never nudged. Nudging to
    // dodge overlap used to compound across a densely-packed lane (each push
    // right made the next card's own true position collide even harder),
    // which on real (non-thin-seed) data could drift a card visually tens of
    // days from where it actually happened — exactly what it looks like when
    // "interactions aren't in the right chronological order." Overlap is
    // resolved on a different axis instead: a second (or third...) sub-track
    // stacked just below, within the same cluster's lane.
    const TRACK_STRIDE = BLOB_H + 10;
    const LANE_GAP = 16;

    const sorted = [...inWindow].sort((a, b) => a.date.getTime() - b.date.getTime());

    // Each connected cluster claims one lane the first time it appears in the
    // chronological stream — unrelated people's threads never share a lane.
    const clusterLane = new Map<string, number>();
    for (const ev of sorted) {
      const key = eventClusterKey.get(ev.id) ?? ev.id;
      if (!clusterLane.has(key)) clusterLane.set(key, clusterLane.size);
    }
    const LANES = Math.max(1, clusterLane.size);

    // Pass 1: true x/width per event, plus which sub-track within its lane it
    // lands on (first track whose last occupant doesn't collide with this
    // card's own true position — classic interval-scheduling, same idea a
    // calendar app uses to stack overlapping events instead of moving them).
    type Placed = { ev: HistoryEvent; lane: number; track: number; left: number; w: number; willShowMarker: boolean };
    const laneTrackRight: number[][] = Array.from({ length: LANES }, () => []);
    const placed: Placed[] = [];

    for (const ev of sorted) {
      const lane = clusterLane.get(eventClusterKey.get(ev.id) ?? ev.id)!;
      const x = xOf(ev.date);
      const metaLineFull = `${ev.entityLabelStr} · ${format(ev.date, "d MMM", { locale: dateLocale })}`;
      const textContentW = Math.max(
        estimateTextWidth(ev.rawText, TITLE_CHAR_W),
        estimateTextWidth(metaLineFull, META_CHAR_W),
      );
      const w = Math.min(CARD_MAX_W, Math.max(CARD_MIN_W, textContentW + CARD_PAD_X * 2 + 14));
      const left = x - w / 2;
      const willShowMarker = Boolean(ev.followUpDate && new Date(ev.followUpDate).getTime() > nowMs);
      // Badge trails the card by MARKER_RESERVE — reserve that too, so a
      // later same-track card can't land inside it.
      const MARKER_RESERVE = 22;
      const right = left + w + (willShowMarker ? MARKER_RESERVE : 0);

      const tracks = laneTrackRight[lane]!;
      let track = tracks.findIndex((r) => r + GAP <= left);
      if (track === -1) {
        track = tracks.length;
        tracks.push(right);
      } else {
        tracks[track] = right;
      }
      placed.push({ ev, lane, track, left, w, willShowMarker });
    }

    // Lanes have variable height now (however many sub-tracks they actually
    // needed), so each lane's Y start is cumulative over the ones before it.
    const laneTrackCount = laneTrackRight.map((tracks) => Math.max(1, tracks.length));
    const laneYStart: number[] = [];
    {
      let cursor = TOP_OFFSET;
      for (let l = 0; l < LANES; l++) {
        laneYStart[l] = cursor;
        cursor += laneTrackCount[l]! * TRACK_STRIDE + LANE_GAP;
      }
    }
    const contentH = (laneYStart[LANES - 1] ?? TOP_OFFSET) + laneTrackCount[LANES - 1]! * TRACK_STRIDE + BOTTOM_MARGIN;

    const blobsOut: BlobShape[] = [];
    const futureMarkersOut: FutureMarkerShape[] = [];
    let maxRight = W;

    for (const { ev, lane, track, left, w, willShowMarker } of placed) {
      const y = laneYStart[lane]! + track * TRACK_STRIDE;
      const sel = selectedEvent?.id === ev.id;
      const textW = w - CARD_PAD_X * 2 - 14;
      const metaLineFull = `${ev.entityLabelStr} · ${format(ev.date, "d MMM", { locale: dateLocale })}`;
      blobsOut.push({
        id: ev.id,
        x: Math.round(left),
        y,
        w,
        h: BLOB_H,
        tint: KIND_STYLE[ev.kind].tint,
        color: KIND_STYLE[ev.kind].color,
        sw: sel ? 2.4 : 1.3,
        title: truncateToWidth(ev.rawText, textW, TITLE_CHAR_W),
        metaLine: truncateToWidth(metaLineFull, textW, META_CHAR_W),
        isDirect: ev.participants.some((p) => p.isMe),
        hasChildren: parentIds.has(ev.id),
        onSelect: () => pickEvent(ev.id),
      });
      maxRight = Math.max(maxRight, left + w + (willShowMarker ? 40 : 8));

      if (willShowMarker) {
        futureMarkersOut.push({
          eventId: ev.id,
          anchorX: left + w,
          x: left + w + 15,
          y: y + BLOB_H / 2,
          color: KIND_STYLE[ev.kind].color,
          followUp: ev.followUp,
          followUpDate: ev.followUpDate,
          onSelect: () => pickEvent(ev.id),
        });
      }
    }

    return { blobs: blobsOut, contentH, canvasW: maxRight, futureMarkers: futureMarkersOut };
  }, [allEvents, eventClusterKey, startMs, endMs, W, matches, selectedEvent?.id, dateLocale, xOf, parentIds, pickEvent, nowMs]);

  // Agenda view: the same windowed/filtered events as the canvas, grouped by
  // calendar day and left in plain top-to-bottom chronological order — a
  // format that can't misrepresent when something happened, unlike a
  // position on an axis.
  const agendaGroups = useMemo(() => {
    const inWin = allEvents.filter((ev) => {
      const ms = ev.date.getTime();
      return ms >= startMs && ms <= endMs && matches(ev);
    });
    const byDay = new Map<string, HistoryEvent[]>();
    for (const ev of inWin) {
      const key = format(ev.date, "yyyy-MM-dd");
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(ev);
    }
    const todayKey = format(now, "yyyy-MM-dd");
    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateKey, evs]) => ({
        dateKey,
        date: evs[0]!.date,
        isToday: dateKey === todayKey,
        events: evs.slice().sort((a, b) => a.date.getTime() - b.date.getTime()),
      }));
  }, [allEvents, startMs, endMs, matches, now]);

  const scrubber = useMemo(() => {
    if (allEvents.length === 0) return null;
    const allStart = allEvents[0]!.date.getTime();
    const allEnd = allEvents[allEvents.length - 1]!.date.getTime();
    const span = Math.max(1, allEnd - allStart);
    const ticks = allEvents.map((ev) => ({
      id: ev.id,
      left: `${(((ev.date.getTime() - allStart) / span) * 98).toFixed(2)}%`,
      height: 8 + ev.participants.length * 5,
      color: KIND_STYLE[ev.kind].color,
      onJump: () => {
        pickEvent(ev.id);
        setScale("month");
        // No floor here — a future-dated event (beyond the default anchor)
        // needs a negative tOffset to bring it into view, same direction the
        // → button now allows.
        setTOffset(Math.round((anchorMs - ev.date.getTime()) / DAY_MS / (SPANS.month * 0.5)));
      },
    }));
    return {
      from: format(new Date(allStart), "d MMM yy", { locale: dateLocale }),
      to: format(new Date(allEnd), "d MMM yy", { locale: dateLocale }),
      ticks,
      windowLeft: `${(Math.max(0, (startMs - allStart) / span) * 100).toFixed(2)}%`,
      windowWidth: `${(Math.min(1, (endMs - startMs) / span) * 100).toFixed(2)}%`,
    };
  }, [allEvents, startMs, endMs, anchorMs, dateLocale, pickEvent]);

  const sidebarList = useMemo(() => allEvents.filter(matches).slice().reverse().slice(0, 26), [allEvents, matches]);

  // Scrubbing maps a position on the all-time strip back to a pan offset. The
  // strip is anchored at the same anchorMs the main window uses (not "now"
  // itself), and tOffset counts half-windows backwards from it, which is what
  // makes this a division by spanDays/2.
  const scrubberRef = useRef<HTMLDivElement>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const allSpan = useMemo(() => {
    if (allEvents.length === 0) return null;
    const from = allEvents[0]!.date.getTime();
    // Domain must reach at least as far as the latest real event — otherwise
    // a genuinely future-dated one (beyond the default anchor) gets no
    // correctly-positioned tick on the all-history strip at all.
    const to = Math.max(anchorMs, allEvents[allEvents.length - 1]!.date.getTime());
    return { from, to, span: Math.max(1, to - from) };
  }, [allEvents, anchorMs]);
  const scrubberFraction = allSpan ? Math.min(1, Math.max(0, (endMs - allSpan.from) / allSpan.span)) : 1;

  const scrubTo = useCallback(
    (clientX: number) => {
      const el = scrubberRef.current;
      if (!el || !allSpan) return;
      const rect = el.getBoundingClientRect();
      const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(1, rect.width)));
      const targetEnd = allSpan.from + fraction * allSpan.span;
      const halfWindowMs = SPANS[scale] * 0.5 * DAY_MS;
      // No floor — scrubbing to the strip's future end (past the default
      // anchor) must be able to produce a negative tOffset.
      setTOffset(Math.round((anchorMs - targetEnd) / halfWindowMs));
    },
    [allSpan, scale, anchorMs],
  );

  const handleScrubStart = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsScrubbing(true);
      scrubTo(e.clientX);
    },
    [scrubTo],
  );
  const handleScrubMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (isScrubbing) scrubTo(e.clientX);
    },
    [isScrubbing, scrubTo],
  );
  const handleScrubEnd = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setIsScrubbing(false);
  }, []);

  const windowLabel = `${format(start, "d MMM yy", { locale: dateLocale })} → ${format(end, "d MMM yy", { locale: dateLocale })}`;

  if (allEvents.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center" style={{ background: "#F7F7F4" }}>
        <History className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t("historyGraph.noEvents")}</p>
      </div>
    );
  }

  return (
    <>
      {/* Full-height shell — event list | canvas | detail panel — each column
          scrolling independently, the page itself never scrolling and never
          scrolling sideways. Columns drop out by width rather than pushing the
          row past the viewport (see the regime comment on `mobilePane`). */}
      <div className="flex h-full flex-col" style={{ background: "#F7F7F4" }}>
        {/* Phone-only pane switcher. The three columns are a desktop layout;
            on a phone they become three destinations. */}
        <div className="flex shrink-0 gap-1 border-b p-2 md:hidden" style={{ borderColor: "#ECEBE7", background: "#FFFFFF" }}>
          {(["list", "chart", "detail"] as const).map((pane) => (
            <button
              key={pane}
              onClick={() => setMobilePane(pane)}
              aria-pressed={mobilePane === pane}
              className={`h-10 flex-1 rounded-lg text-[12.5px] font-semibold transition-colors ${
                mobilePane === pane ? "text-white" : "text-[#3A3C42]"
              }`}
              style={{ background: mobilePane === pane ? "#1B1D21" : "#fff", border: "1px solid #ECEBE7" }}
            >
              {pane === "list" ? t("historyGraph.paneList") : pane === "chart" ? t("historyGraph.paneChart") : t("historyGraph.paneDetail")}
            </button>
          ))}
        </div>

        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          {/* LEFT: events sidebar */}
          <div
            className={`${mobilePane === "list" ? "flex" : "hidden"} w-full flex-col gap-[13px] overflow-auto p-4 md:flex md:w-[240px] md:flex-none md:px-[14px] wide:w-[266px]`}
            style={{ background: "#FFFFFF", borderRight: "1px solid #ECEBE7", maxHeight: "100%" }}
          >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t("historyGraph.sidebarTitle")}</div>
              <div style={{ fontSize: 11, color: "#8C8C86", marginTop: 2 }}>
                {sidebarList.length} {t("historyGraph.eventsInView")}
              </div>
            </div>
            {!isAddingRootEntry && entityOptions.length > 0 && (
              <button
                onClick={startAddingRootEntry}
                className="flex shrink-0 cursor-pointer items-center gap-1 rounded-[8px] border px-[9px] py-[6px] hover:bg-[#FBFBF9]"
                style={{ borderColor: "#ECEBE7", color: "#3A3C42", fontSize: 11, fontWeight: 600, background: "none" }}
              >
                <Plus className="size-3" />
                {t("cluster.newEntry").replace(/^\+\s*/, "")}
              </button>
            )}
          </div>

          {isAddingRootEntry && (
            <div className="flex flex-col gap-1.5 rounded-[10px] border p-2.5" style={{ borderColor: "#ECEBE7", background: "#FBFBF9" }}>
              <Select value={newEntryKey} onValueChange={(v) => setNewEntryKey(v || "")}>
                <SelectTrigger className="h-7 w-full text-xs">
                  <SelectValue placeholder={t("historyGraph.selectEntity")}>
                    {(value: string | null) => entityOptions.find((o) => o.key === value)?.label ?? value}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {entityOptions.map((opt) => (
                    <SelectItem key={opt.key} value={opt.key} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Connections always save as MEMO server-side (no type field
                  on that route) — hiding the picker there instead of showing
                  a control that silently does nothing. */}
              {!newEntryKey.startsWith("connection:") && (
                <Select value={newEntryType} onValueChange={(v) => setNewEntryType((v as InteractionType) || "MEMO")}>
                  <SelectTrigger className="h-7 w-full text-xs">
                    <SelectValue>{(v: string | null) => (v ? t(`interactionType.${v as InteractionType}`) : "")}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(["MEETING", "CALL", "INTRO", "EMAIL", "WORKSHOP", "MEMO"] as InteractionType[]).map((kind) => (
                      <SelectItem key={kind} value={kind} className="text-xs">
                        {t(`interactionType.${kind}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Textarea
                value={newEntryText}
                onChange={(e) => setNewEntryText(e.target.value)}
                placeholder={t("cluster.newEntryPlaceholder")}
                autoFocus
                className="min-h-16 resize-none border-border bg-white text-base md:text-xs"
                disabled={isSavingRootEntry}
              />
              <FollowUpFields
                enabled={newEntryFollowUpOn}
                onToggle={() => setNewEntryFollowUpOn((v) => !v)}
                date={newEntryFollowUpDate}
                onDateChange={setNewEntryFollowUpDate}
                text={newEntryFollowUpText}
                onTextChange={setNewEntryFollowUpText}
                disabled={isSavingRootEntry}
              />
              <div className="flex justify-end gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsAddingRootEntry(false);
                    setNewEntryText("");
                    setNewEntryType("MEMO");
                    setNewEntryFollowUpOn(false);
                    setNewEntryFollowUpDate("");
                    setNewEntryFollowUpText("");
                  }}
                  disabled={isSavingRootEntry}
                  className="h-7 text-[11px]"
                >
                  {t("cluster.expand.cancel")}
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddRootEntry}
                  disabled={isSavingRootEntry || !newEntryText.trim() || !newEntryKey}
                  className="h-7 gap-1.5 text-[11px]"
                >
                  {isSavingRootEntry && <Loader2 className="size-3 animate-spin" />}
                  {t("cluster.expand.save")}
                </Button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 rounded-[9px] border px-[10px] py-[7px]" style={{ background: "#fff", borderColor: "#ECEBE7" }}>
            <Search className="size-[13px] shrink-0" style={{ color: "#9A9A94" }} />
            {/* 16px on phones: iOS Safari force-zooms the page when a focused
                field is smaller, which here means zooming into a canvas the
                user then has to fight back out of. */}
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("historyGraph.searchPlaceholder")}
              type="search"
              inputMode="search"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full border-none bg-transparent text-base outline-none md:text-xs"
              style={{ fontFamily: "var(--font-sans)" }}
            />
          </div>
          <div className="flex flex-col gap-[6px]">
            {sidebarList.map((ev) => {
              const active = selectedEvent?.id === ev.id;
              return (
                <div
                  key={ev.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => pickEvent(ev.id)}
                  onKeyDown={(e) => e.key === "Enter" && pickEvent(ev.id)}
                  onMouseDown={(e) => e.preventDefault()}
                  className="relative cursor-pointer rounded-[11px] border px-[10px] py-[9px] hover:border-[#E4E3DE]"
                  style={{ borderColor: "#F1F0EC", background: "#fff", borderLeft: `3px solid ${KIND_STYLE[ev.kind].color}` }}
                >
                  {active && <div className="pointer-events-none absolute inset-0 rounded-[11px]" style={{ border: "1.5px solid #5B8DEF" }} />}
                  <div className="relative" style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>
                    {ev.rawText.length > 26 ? `${ev.rawText.slice(0, 25)}…` : ev.rawText}
                  </div>
                  <div className="relative flex items-center gap-[6px]" style={{ marginTop: 5, fontFamily: "var(--font-mono)", fontSize: 9.5, color: "#8C8C86" }}>
                    <span>{format(ev.date, "d MMM yy", { locale: dateLocale })}</span>
                    <span>·</span>
                    <span>
                      {ev.participants.length} {t("historyGraph.entitiesCount")}
                    </span>
                  </div>
                  <div className="relative flex gap-[3px]" style={{ marginTop: 7 }}>
                    {ev.participants.map((p) => (
                      <div key={p.id} className="size-[7px] rounded-full" style={{ background: p.color }} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-auto flex flex-col gap-[6px] border-t pt-3" style={{ borderColor: "#F1F0EC" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, letterSpacing: "0.09em", textTransform: "uppercase", color: "#9A9A94", marginBottom: 2 }}>
              {t("historyGraph.legendTitle")}
            </div>
            {(["MEETING", "CALL", "INTRO", "EMAIL", "WORKSHOP", "MEMO"] as InteractionType[]).map((kind) => (
              <div key={kind} className="flex items-center gap-[7px]" style={{ fontSize: 11, color: "#3A3C42" }}>
                <div className="size-3 rounded shrink-0" style={{ border: `1.5px solid ${KIND_STYLE[kind].color}`, background: KIND_STYLE[kind].tint }} />
                {t(`interactionType.${kind}`)}
              </div>
            ))}
          </div>
        </div>

        {/* MAIN: header + canvas + scrubber */}
          <div className={`${mobilePane === "chart" ? "flex" : "hidden"} min-h-0 w-full min-w-0 flex-1 flex-col md:flex`}>
            <div className="flex flex-wrap items-center gap-3 px-4 py-3 md:gap-[14px] md:px-[22px] md:py-4" style={{ borderBottom: "1px solid #ECEBE7", background: "rgba(255,255,255,.72)" }}>
              <div className="hidden md:block">
                <div className="flex items-center gap-2">
                  <h1 style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: "-0.3px" }}>{t("dashboard.tab.timeline")}</h1>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      padding: "3px 7px",
                      borderRadius: 5,
                      background: "#EAF1FE",
                      color: "#5B8DEF",
                    }}
                  >
                    {t("historyGraph.badge")}
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: "#8C8C86", marginTop: 3 }}>{t("historyGraph.subtitle")}</div>
              </div>
              <div className="flex gap-1 rounded-[10px] border p-1 md:ml-auto" style={{ background: "#fff", borderColor: "#ECEBE7" }}>
                <button
                  onClick={() => setViewMode("canvas")}
                  aria-pressed={viewMode === "canvas"}
                  title={t("historyGraph.viewCanvas")}
                  className="flex size-9 items-center justify-center rounded-[7px] hover:bg-[#F6F6F4] md:size-[26px]"
                  style={{ border: "none", background: viewMode === "canvas" ? "#1B1D21" : "transparent", color: viewMode === "canvas" ? "#fff" : "#3A3C42", cursor: "pointer" }}
                >
                  <LayoutGrid className="size-[13px]" />
                </button>
                <button
                  onClick={() => setViewMode("agenda")}
                  aria-pressed={viewMode === "agenda"}
                  title={t("historyGraph.viewAgenda")}
                  className="flex size-9 items-center justify-center rounded-[7px] hover:bg-[#F6F6F4] md:size-[26px]"
                  style={{ border: "none", background: viewMode === "agenda" ? "#1B1D21" : "transparent", color: viewMode === "agenda" ? "#fff" : "#3A3C42", cursor: "pointer" }}
                >
                  <CalendarDays className="size-[13px]" />
                </button>
              </div>
              <div className="flex flex-1 gap-[5px] rounded-[10px] border p-1 md:ml-0 md:flex-none" style={{ background: "#fff", borderColor: "#ECEBE7" }}>
                {SCALES.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setScale(s);
                      setTOffset(0);
                    }}
                    aria-pressed={scale === s}
                    className="h-9 flex-1 rounded-[7px] px-2 md:h-auto md:flex-none md:px-[11px] md:py-[5px]"
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      color: scale === s ? "#fff" : "#3A3C42",
                      background: scale === s ? "#1B1D21" : "transparent",
                      border: "none",
                    }}
                  >
                    {t(`historyGraph.${s}`)}
                  </button>
                ))}
              </div>
              <div className="flex gap-1 rounded-[10px] border p-1" style={{ background: "#fff", borderColor: "#ECEBE7" }}>
                <button
                  onClick={() => setTOffset((o) => o + 1)}
                  aria-label={t("historyGraph.panBack")}
                  className="flex size-9 items-center justify-center rounded-[7px] hover:bg-[#F6F6F4] md:size-[26px]"
                  style={{ fontSize: 14, cursor: "pointer", color: "#3A3C42", border: "none", background: "transparent" }}
                >
                  ←
                </button>
                <button
                  onClick={() => setTOffset(0)}
                  aria-label={t("historyGraph.jumpToNow")}
                  title={t("historyGraph.jumpToNow")}
                  disabled={tOffset === 0}
                  className="flex h-9 items-center justify-center rounded-[7px] px-2.5 text-[11.5px] font-semibold hover:bg-[#F6F6F4] disabled:opacity-35 md:h-[26px]"
                  style={{ cursor: "pointer", color: "#3A3C42", border: "none", background: "transparent" }}
                >
                  {t("historyGraph.now")}
                </button>
                <button
                  onClick={() => setTOffset((o) => o - 1)}
                  aria-label={t("historyGraph.panFwd")}
                  className="flex size-9 items-center justify-center rounded-[7px] hover:bg-[#F6F6F4] md:size-[26px]"
                  style={{ fontSize: 14, cursor: "pointer", color: "#3A3C42", border: "none", background: "transparent" }}
                >
                  →
                </button>
              </div>
              <button
                onClick={() => setDetailOpen((o) => !o)}
                aria-pressed={detailOpen}
                title={t("historyGraph.paneDetail")}
                className="hidden size-[26px] flex-none items-center justify-center rounded-[7px] border hover:bg-[#F6F6F4] md:flex wide:hidden"
                style={{ borderColor: "#ECEBE7", background: detailOpen ? "#F4F4F1" : "#fff", color: "#3A3C42" }}
              >
                <PanelRight className="size-[13px]" />
              </button>
            </div>

            <div
              ref={canvasRef}
              className="relative flex-1 overflow-auto"
              style={{ display: viewMode === "canvas" ? undefined : "none" }}
            >
              <svg width={Math.max(W, canvasW)} height={Math.max(H, contentH)} className="absolute inset-0">
                {axisTicks.map((tick, i) => (
                  <g key={i}>
                    <line x1={tick.x} y1={34} x2={tick.x} y2={Math.max(H, contentH)} stroke="#F1F0EC" strokeWidth={1} />
                    <text x={tick.x} y={24} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={10.5} fill="#8C8C86">
                      {tick.label}
                    </text>
                  </g>
                ))}
                {blobs.map((b) => (
                  <g key={b.id} onClick={b.onSelect} style={{ cursor: "pointer" }}>
                    {/* A visible ring behind the selected card, tying it back to
                        the open detail panel — the stroke-width bump alone read
                        as "slightly bolder," not "this is the open one." */}
                    {b.sw > 2 && (
                      <rect x={b.x - 3} y={b.y - 3} width={b.w + 6} height={b.h + 6} rx={13} fill="none" stroke={b.color} strokeWidth={1.4} strokeOpacity={0.35} />
                    )}
                    <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={10} fill={b.tint} stroke={b.color} strokeWidth={b.sw} />
                    <rect x={b.x} y={b.y} width={4} height={b.h} fill={b.color} />
                    {/* Filled dot = an event I was directly part of; hollow = one
                        I only logged secondhand — same grammar the workflow
                        diagram uses for its main-line vs. branch nodes. */}
                    <circle cx={b.x + 15} cy={b.y + 15} r={4} fill={b.isDirect ? b.color : "#fff"} stroke={b.color} strokeWidth={1.4} />
                    <text x={b.x + 24} y={b.y + 19} fontFamily="var(--font-sans)" fontSize={12} fontWeight={600} fill="#3A3C42">
                      {b.title}
                    </text>
                    <text x={b.x + 24} y={b.y + 34} fontFamily="var(--font-mono)" fontSize={9.5} fill="#8C8C86">
                      {b.metaLine}
                    </text>
                    {/* Branch-existence badge — visible on the canvas itself, so
                        "this event led to more" doesn't stay hidden until you
                        open the detail panel. */}
                    {b.hasChildren && (
                      <g transform={`translate(${b.x + b.w - 15}, ${b.y + 9})`}>
                        <title>{t("historyGraph.hasBranches")}</title>
                        <circle r={8} fill="#fff" stroke={b.color} strokeWidth={1.3} />
                        <GitBranch x={-5} y={-5} width={10} height={10} color={b.color} strokeWidth={2.2} />
                      </g>
                    )}
                  </g>
                ))}
                {futureMarkers.map((m) => (
                  <g key={`fu-${m.eventId}`} onClick={m.onSelect} style={{ cursor: "pointer" }}>
                    <title>
                      {`${t("cluster.upcoming")} · ${m.followUpDate ? format(new Date(m.followUpDate), "d MMM yyyy", { locale: dateLocale }) : ""}\n${m.followUp ?? ""}`}
                    </title>
                    <line x1={m.anchorX} y1={m.y} x2={m.x - 7} y2={m.y} stroke={m.color} strokeWidth={1.2} strokeDasharray="2.5 2" opacity={0.7} />
                    <circle cx={m.x} cy={m.y} r={7} fill="#fff" stroke={m.color} strokeWidth={1.5} strokeDasharray="2.5 2" />
                  </g>
                ))}
                {/* "Today" — the anchor everything else in this view is
                    relative to, otherwise invisible on a canvas with no day
                    cells. Guarded so panning far enough back doesn't leave a
                    stray off-canvas line mounted for nothing. */}
                {nowMs >= startMs && nowMs <= endMs && (
                  <g>
                    <line x1={Math.round(xOf(now))} y1={34} x2={Math.round(xOf(now))} y2={Math.max(H, contentH)} stroke="#1B1D21" strokeWidth={1.2} strokeDasharray="3 3" opacity={0.55} />
                    <text x={Math.round(xOf(now)) + 4} y={46} fontFamily="var(--font-mono)" fontSize={9.5} fill="#1B1D21" opacity={0.7}>
                      {t("historyGraph.today")}
                    </text>
                  </g>
                )}
                <line x1={0} y1={34} x2={Math.max(W, canvasW)} y2={34} stroke="#E4E3DE" strokeWidth={1} />
              </svg>
            </div>

            {viewMode === "agenda" && (
              <div className="flex-1 overflow-auto px-4 py-4 md:px-[22px]">
                {agendaGroups.length === 0 ? (
                  <p className="text-xs" style={{ color: "#8C8C86" }}>
                    {t("historyGraph.agendaEmpty")}
                  </p>
                ) : (
                  <div className="flex flex-col gap-5">
                    {agendaGroups.map((group) => (
                      <div key={group.dateKey}>
                        <div className="mb-2 flex items-center gap-2">
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: group.isToday ? "#5B8DEF" : "#1B1D21" }}>
                            {format(group.date, "EEEE, d MMMM", { locale: dateLocale })}
                          </div>
                          {group.isToday && (
                            <span
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: 8.5,
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                                padding: "2px 6px",
                                borderRadius: 5,
                                background: "#EAF1FE",
                                color: "#5B8DEF",
                              }}
                            >
                              {t("historyGraph.today")}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col gap-[6px]">
                          {group.events.map((ev) => {
                            const active = selectedEvent?.id === ev.id;
                            const hasFollowUp = Boolean(ev.followUpDate && new Date(ev.followUpDate).getTime() > nowMs);
                            return (
                              <button
                                key={ev.id}
                                onClick={() => pickEvent(ev.id)}
                                className="flex w-full items-start gap-[10px] rounded-[11px] border px-[12px] py-[10px] text-left hover:bg-[#FBFBF9]"
                                style={{
                                  borderColor: active ? KIND_STYLE[ev.kind].color : "#ECEBE7",
                                  background: active ? KIND_STYLE[ev.kind].tint : "#fff",
                                  cursor: "pointer",
                                }}
                              >
                                <div
                                  className="mt-[3px] size-[9px] shrink-0 rounded-full"
                                  style={{ background: ev.participants.some((p) => p.isMe) ? KIND_STYLE[ev.kind].color : "#fff", border: `1.5px solid ${KIND_STYLE[ev.kind].color}` }}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-[6px]">
                                    <span className="truncate" style={{ fontSize: 12.5, fontWeight: 600, color: "#1B1D21" }}>
                                      {ev.rawText}
                                    </span>
                                    {parentIds.has(ev.id) && <GitBranch className="size-2.5 shrink-0" style={{ color: "#8C8C86" }} />}
                                  </div>
                                  <div className="mt-[2px] flex flex-wrap items-center gap-[6px]" style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#8C8C86" }}>
                                    <span>{ev.entityLabelStr}</span>
                                    <span>·</span>
                                    <span>{t(`interactionType.${ev.kind}`)}</span>
                                    {hasFollowUp && (
                                      <span className="flex items-center gap-1" style={{ color: "#B45309" }}>
                                        <CalendarClock className="size-2.5" />
                                        {format(new Date(ev.followUpDate!), "d MMM", { locale: dateLocale })}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex h-[86px] flex-none flex-col gap-[6px] px-4 py-[10px] md:h-[78px] md:px-[22px]" style={{ borderTop: "1px solid #ECEBE7", background: "rgba(255,255,255,.66)" }}>
              <div className="flex justify-between gap-2" style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9A9A94" }}>
                <span className="hidden sm:inline">{t("historyGraph.allHistory")}</span>
                {scrubber && (
                  <span className="hidden truncate sm:inline">
                    {scrubber.from} → {scrubber.to}
                  </span>
                )}
                <span className="truncate">{windowLabel}</span>
              </div>
              {/* Scrub by dragging anywhere on the strip. It used to be a
                  read-out only — the window rectangle was pointer-events:none,
                  so the one control that shows where you are in the whole
                  history could not be used to move there. */}
              <div
                ref={scrubberRef}
                role="slider"
                tabIndex={0}
                aria-label={t("historyGraph.scrubberLabel")}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(scrubberFraction * 100)}
                onPointerDown={handleScrubStart}
                onPointerMove={handleScrubMove}
                onPointerUp={handleScrubEnd}
                onPointerCancel={handleScrubEnd}
                onKeyDown={(e) => {
                  if (e.key === "ArrowLeft") setTOffset((o) => o + 1);
                  if (e.key === "ArrowRight") setTOffset((o) => Math.max(0, o - 1));
                }}
                className="relative flex-1 cursor-ew-resize touch-none overflow-hidden rounded-[9px] border"
                style={{ background: "#fff", borderColor: "#ECEBE7" }}
              >
                {scrubber?.ticks.map((tick) => (
                  <div
                    key={tick.id}
                    className="pointer-events-none absolute bottom-[6px] w-1 rounded-[2px]"
                    style={{ background: tick.color, left: tick.left, height: tick.height }}
                  />
                ))}
                {scrubber && (
                  <div
                    className="pointer-events-none absolute top-0 bottom-0 rounded-[7px]"
                    style={{ background: "rgba(78,127,212,.14)", border: "1.5px solid #5B8DEF", left: scrubber.windowLeft, width: scrubber.windowWidth }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Backdrop for the >= 768 overlay case: without it the detail panel
              reads as broken layout (a card floating over content with no
              visual cue it's a dismissible drawer) rather than an intentional
              overlay. Hidden below md (there the panel IS the pane, full-width,
              nothing underneath to dim). The panel is now an overlay at every
              width >= md — including wide — so the canvas keeps its full width
              whether or not something's selected, instead of permanently
              ceding a third column to a panel that's often empty. */}
          {selectedEvent && detailOpen && (
            <button
              type="button"
              aria-label={t("cluster.expand.close")}
              onClick={() => setDetailOpen(false)}
              className="absolute inset-0 z-20 hidden cursor-default md:block"
              style={{ background: "rgba(27,29,33,.24)", border: "none" }}
            />
          )}

          {/* RIGHT: detail panel. Always an overlay at >= 768 (anchored to the
              right edge, its own dismiss state rather than only clearing the
              selection) so the canvas never loses width to it. Below 768 it is
              one of the three panes. */}
          {selectedEvent && (
            <div
              className={[
                "w-full flex-col gap-[14px] overflow-auto p-[18px]",
                mobilePane === "detail" ? "flex" : "hidden",
                detailOpen ? "md:flex" : "md:hidden",
                // Widens progressively — it's always an overlay (never a
                // static column stealing canvas width), so there's no reason
                // to keep it pinned to a narrow 320px once the viewport
                // actually has room to spare.
                "md:absolute md:inset-y-0 md:right-0 md:z-30 md:w-[360px] wide:w-[440px] md:shadow-[-8px_0_24px_-12px_rgba(27,29,33,.28)]",
              ].join(" ")}
              style={{ background: "#fff", borderLeft: "1px solid #ECEBE7", maxHeight: "100%" }}
            >
                  <div className="flex items-start gap-[10px]">
                    <div
                      className="size-[34px] flex-none rounded-[11px]"
                      style={{ border: `1.5px solid ${KIND_STYLE[selectedEvent.kind].color}`, background: KIND_STYLE[selectedEvent.kind].tint }}
                    />
                    <div className="min-w-0 flex-1">
                      <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.3 }}>{selectedEvent.entityLabelStr}</div>
                      {isEditingDate ? (
                        <div className="mt-1.5 flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <Select value={editType} onValueChange={(v) => setEditType((v as InteractionType) || "MEMO")}>
                              <SelectTrigger className="h-7 flex-1 text-xs">
                                <SelectValue>{(v: string | null) => (v ? t(`interactionType.${v as InteractionType}`) : "")}</SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {(["MEETING", "CALL", "INTRO", "EMAIL", "WORKSHOP", "MEMO"] as InteractionType[]).map((kind) => (
                                  <SelectItem key={kind} value={kind} className="text-xs">
                                    {t(`interactionType.${kind}`)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <input
                              type="date"
                              value={editDate}
                              onChange={(e) => setEditDate(e.target.value)}
                              disabled={isSavingDate}
                              className="h-7 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            />
                          </div>
                          <div className="flex justify-end gap-1.5">
                            <Button size="sm" variant="outline" onClick={() => setIsEditingDate(false)} disabled={isSavingDate} className="h-7 text-[11px]">
                              {t("cluster.expand.cancel")}
                            </Button>
                            <Button size="sm" onClick={handleSaveDate} disabled={isSavingDate || !editDate} className="h-7 text-[11px]">
                              {isSavingDate && <Loader2 className="size-3 animate-spin" />}
                              {t("cluster.expand.save")}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-[3px] flex items-center gap-1.5" style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#8C8C86" }}>
                          <span>
                            {format(selectedEvent.date, "d MMM yy", { locale: dateLocale })} · {t(`interactionType.${selectedEvent.kind}`)}
                          </span>
                          <button
                            onClick={startEditingDate}
                            aria-label={t("historyGraph.reschedule")}
                            title={t("historyGraph.reschedule")}
                            className="flex size-4 items-center justify-center rounded hover:bg-[#F6F6F4]"
                            style={{ color: "#A6A6A0", cursor: "pointer", background: "none", border: "none" }}
                          >
                            <Pencil className="size-2.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => pickEvent(null)}
                      aria-label={t("cluster.expand.close")}
                      className="flex size-7 flex-none items-center justify-center rounded-md hover:bg-[#F6F6F4]"
                      style={{ fontSize: 13, color: "#A6A6A0", cursor: "pointer", background: "none", border: "none" }}
                    >
                      ✕
                    </button>
                  </div>

                  {parentEvent && (
                    <button
                      onClick={() => pickEvent(parentEvent.id)}
                      className="flex items-center gap-1 text-left hover:opacity-80"
                      style={{ fontSize: 10.5, color: "#8C8C86", background: "none", border: "none", cursor: "pointer" }}
                    >
                      <GitBranch className="size-2.5 shrink-0" />
                      <span className="truncate">
                        {t("cluster.branchedFrom")} {parentEvent.entityLabelStr} — {parentEvent.rawText.length > 40 ? `${parentEvent.rawText.slice(0, 40)}…` : parentEvent.rawText}
                      </span>
                    </button>
                  )}

                  {selectedEvent.followUpDate && new Date(selectedEvent.followUpDate) > now && (
                    <div className="flex items-start gap-2 rounded-lg border border-dashed border-amber-400/50 bg-amber-400/10 px-2.5 py-2">
                      <CalendarClock className="mt-0.5 size-3 shrink-0 text-amber-700" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                          {t("timeline.upcoming")} · {format(new Date(selectedEvent.followUpDate), "d MMM", { locale: dateLocale })}
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-amber-900/90">{selectedEvent.followUp}</p>
                      </div>
                    </div>
                  )}

                  <div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.09em", textTransform: "uppercase", color: "#9A9A94", marginBottom: 8 }}>
                      {t("historyGraph.notes")}
                    </div>
                    <div
                      className="whitespace-pre-wrap"
                      style={{ fontSize: 12.5, lineHeight: 1.55, color: "#3A3C42", background: "#FBFBF9", border: "1px solid #F1F0EC", borderRadius: 11, padding: "11px 12px" }}
                    >
                      {selectedEvent.rawText}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.09em", textTransform: "uppercase", color: "#9A9A94", marginBottom: 8 }}>
                      {t("historyGraph.participants")}
                    </div>
                    <div className="flex flex-col gap-[6px]">
                      {selectedEvent.participants.map((p) => (
                        <div
                          key={p.id}
                          role={p.isMe ? undefined : "button"}
                          tabIndex={p.isMe ? undefined : 0}
                          onClick={p.isMe ? undefined : () => router.push(`/contacts/${p.id}`)}
                          onKeyDown={p.isMe ? undefined : (e) => e.key === "Enter" && router.push(`/contacts/${p.id}`)}
                          onMouseDown={p.isMe ? undefined : (e) => e.preventDefault()}
                          className={`flex items-center gap-[9px] rounded-[10px] border px-[9px] py-2 ${p.isMe ? "" : "cursor-pointer hover:bg-[#FBFBF9]"}`}
                          style={{ borderColor: "#ECEBE7" }}
                        >
                          <div className="size-[9px] shrink-0 rounded-full" style={{ background: p.color }} />
                          <div className="min-w-0">
                            <div className="truncate" style={{ fontSize: 12, fontWeight: 600 }}>
                              {p.name}
                            </div>
                            {p.category && <div style={{ fontSize: 10.5, color: "#8C8C86" }}>{t(`category.${p.category}`)}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {touchedRelationships.length > 0 && (
                    <div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.09em", textTransform: "uppercase", color: "#9A9A94", marginBottom: 8 }}>
                        {t("historyGraph.touchedRelationships")}
                      </div>
                      <div className="flex flex-col gap-[6px]">
                        {touchedRelationships.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => router.push(`/network?focus=${c.fromContactId}`)}
                            onMouseDown={(e) => e.preventDefault()}
                            className="flex items-center gap-[7px] rounded-[10px] border px-[9px] py-[7px] text-left hover:bg-[#FBFBF9]"
                            style={{ borderColor: "#ECEBE7", cursor: "pointer", background: "none" }}
                          >
                            <span className="min-w-0 flex-1 truncate" style={{ fontSize: 11.5 }}>
                              {c.fromName} ↔ {c.toName}
                            </span>
                            {c.relationship && (
                              <span
                                className="shrink-0 truncate"
                                style={{ fontSize: 9.5, fontWeight: 600, padding: "2px 6px", borderRadius: 20, background: "#F6F6F4", color: "#3A3C42", maxWidth: 90 }}
                              >
                                {c.relationship}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {isAddingNote ? (
                    <div className="flex flex-col gap-1.5">
                      {/* Names the exact thread this attaches to — this used to
                          be an unlabeled "+ Add note", which made it easy to
                          save a follow-up onto whatever card happened to still
                          be selected rather than the one just read. */}
                      <div style={{ fontSize: 10.5, color: "#8C8C86" }}>
                        {t("historyGraph.addNote")} · {selectedEvent.entityLabelStr}
                      </div>
                      {!selectedEvent.entityKeyStr.startsWith("connection:") && (
                        <Select value={noteType} onValueChange={(v) => setNoteType((v as InteractionType) || "MEMO")}>
                          <SelectTrigger className="h-7 w-full text-xs">
                            <SelectValue>{(v: string | null) => (v ? t(`interactionType.${v as InteractionType}`) : "")}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {(["MEETING", "CALL", "INTRO", "EMAIL", "WORKSHOP", "MEMO"] as InteractionType[]).map((kind) => (
                              <SelectItem key={kind} value={kind} className="text-xs">
                                {t(`interactionType.${kind}`)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <Textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder={t("historyGraph.addNotePlaceholder")}
                        autoFocus
                        className="min-h-16 resize-none border-border bg-muted text-base md:text-xs"
                        disabled={isSavingNote}
                      />
                      <FollowUpFields
                        enabled={noteFollowUpOn}
                        onToggle={() => setNoteFollowUpOn((v) => !v)}
                        date={noteFollowUpDate}
                        onDateChange={setNoteFollowUpDate}
                        text={noteFollowUpText}
                        onTextChange={setNoteFollowUpText}
                        disabled={isSavingNote}
                      />
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setIsAddingNote(false);
                            setNoteType("MEMO");
                            setNoteFollowUpOn(false);
                            setNoteFollowUpDate("");
                            setNoteFollowUpText("");
                          }}
                          disabled={isSavingNote}
                          className="h-7 text-[11px]"
                        >
                          {t("cluster.expand.cancel")}
                        </Button>
                        <Button size="sm" onClick={handleAddNote} disabled={isSavingNote || !noteText.trim()} className="h-7 gap-1.5 text-[11px]">
                          {isSavingNote && <Loader2 className="size-3 animate-spin" />}
                          {t("cluster.expand.save")}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsAddingNote(true)}
                      className="flex cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border text-center hover:bg-[#FBFBF9]"
                      style={{ padding: "9px 12px", borderColor: "#ECEBE7", color: "#3A3C42", fontSize: 11.5, fontWeight: 600, background: "none" }}
                    >
                      <Plus className="size-3" />
                      {t("historyGraph.addNote")} · {selectedEvent.entityLabelStr}
                    </button>
                  )}

                  {/* The workflow diagram is a Contact/ContactConnection BFS
                      — a company/community event has no cluster to open
                      there, so the button is hidden rather than opening into
                      a "Failed to load" dead end. */}
                  {(selectedEvent.entityKeyStr.startsWith("contact:") || selectedEvent.entityKeyStr.startsWith("connection:")) && (
                    <button
                      onClick={() => setWorkflowOpen(true)}
                      className="cursor-pointer rounded-[10px] text-center"
                      style={{ padding: "9px 12px", background: "#1B1D21", color: "#fff", fontSize: 11.5, fontWeight: 600, border: "none" }}
                    >
                      {t("historyGraph.openFullHistory")}
                    </button>
                  )}

                  <button
                    onClick={() => setIsDeleteOpen(true)}
                    className="flex cursor-pointer items-center justify-center gap-1.5 rounded-[10px] text-center hover:bg-red-50"
                    style={{ padding: "9px 12px", color: "#B3261E", fontSize: 11.5, fontWeight: 600, border: "none", background: "none" }}
                  >
                    <Trash2 className="size-3" />
                    {t("common.delete")}
                  </button>
                </div>
              )}
          </div>
        </div>

      <ClusterWorkflowDiagram
        open={workflowOpen}
        onOpenChange={setWorkflowOpen}
        entityKey={selectedEvent?.entityKeyStr ?? null}
        initialEventId={selectedEvent?.id ?? null}
      />

      <ConfirmDeleteDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        description={t("historyGraph.deleteConfirm")}
        onConfirm={handleDeleteSelected}
      />
    </>
  );
}
