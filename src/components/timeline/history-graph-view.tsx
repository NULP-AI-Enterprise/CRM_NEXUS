"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, GitBranch, History, PanelRight, Search } from "lucide-react";
import { format } from "date-fns";
import { uk, enUS } from "date-fns/locale";

import { ClusterWorkflowDiagram } from "@/components/timeline/cluster-workflow-diagram";
import { useTranslation } from "@/lib/i18n/context";
import { entityKey, entityLabel, type TimelineEvent } from "@/lib/timeline-entity";
import { CATEGORY_COLORS, INTERACTION_KIND_STYLE } from "@/lib/contact-display";
import type { ConnectionWithNames } from "@/lib/data/connections";
import type { ContactCategory, InteractionType } from "@/generated/prisma/enums";

const KIND_STYLE = INTERACTION_KIND_STYLE;

const ME_ID = "__me";
const DAY_MS = 86400000;
type Scale = "day" | "week" | "month" | "year";
const SPANS: Record<Scale, number> = { day: 14, week: 70, month: 210, year: 460 };
const SCALES: Scale[] = ["day", "week", "month", "year"];
/** Approximate advance width of the 12px semibold caption face, used only to
 * decide how many characters fit before the canvas edge. */
const TITLE_CHAR_W = 6.4;

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
    const participants: Participant[] =
      e.entity.kind === "contact"
        ? [
            { id: ME_ID, name: meLabel, color: "var(--primary)", isMe: true, category: null },
            {
              id: e.entity.contact.id,
              name: e.entity.contact.fullName,
              color: CATEGORY_COLORS[e.entity.contact.category as ContactCategory]?.dot ?? CATEGORY_COLORS.OTHER.dot,
              isMe: false,
              category: e.entity.contact.category as ContactCategory,
            },
          ]
        : [
            { id: e.entity.fromContact.id, name: e.entity.fromContact.fullName, color: CATEGORY_COLORS.OTHER.dot, isMe: false, category: null },
            { id: e.entity.toContact.id, name: e.entity.toContact.fullName, color: CATEGORY_COLORS.OTHER.dot, isMe: false, category: null },
          ];
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
  lx: number;
  ly: number;
  ly2: number;
  title: string;
  dateLabel: string;
  hasChildren: boolean;
  nodes: Array<{ cx: number; cy: number; color: string }>;
  onSelect: () => void;
}

interface PackShape {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  ty: number;
  label: string;
  onZoomIn: () => void;
}

const shapeD = (type: string, r: number) => {
  if (type === "person") return `M 0 ${-r} A ${r} ${r} 0 1 1 0 ${r} A ${r} ${r} 0 1 1 0 ${-r}`;
  if (type === "company") {
    const a = r * 0.88;
    return `M ${-a} ${-a} H ${a} V ${a} H ${-a} Z`;
  }
  if (type === "community") {
    const a = r * 1.05;
    const b = r * 0.6;
    return `M 0 ${-a} L ${a} ${b} L ${-a} ${b} Z`;
  }
  if (type === "project") {
    const a = r * 0.88;
    return `M 0 ${-a} L ${a} 0 L 0 ${a} L ${-a} 0 Z`;
  }
  return `M 0 ${-r} A ${r} ${r} 0 1 1 0 ${r} A ${r} ${r} 0 1 1 0 ${-r}`;
};

export function HistoryGraphView({
  events,
  connections,
  nowIso,
}: {
  events: TimelineEvent[];
  connections: ConnectionWithNames[];
  nowIso: string;
}) {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const dateLocale = locale === "uk" ? uk : enUS;
  const meLabel = t("cluster.me");

  const [scale, setScale] = useState<Scale>("month");
  const [tOffset, setTOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [workflowOpen, setWorkflowOpen] = useState(false);
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
   * in — a tap that visibly does nothing reads as a broken control. */
  const pickEvent = useCallback((id: string) => {
    setSelectedId(id);
    setMobilePane("detail");
    setDetailOpen(true);
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

  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const nowMs = now.getTime();
  const allEvents = useMemo(() => buildHistoryEvents(events, meLabel), [events, meLabel]);

  const spanDays = SPANS[scale];
  const endMs = nowMs - tOffset * spanDays * 0.5 * DAY_MS;
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

  const { blobs, packs } = useMemo(() => {
    const inWindow = allEvents.filter((ev) => {
      const evMs = ev.date.getTime();
      return evMs >= startMs && evMs <= endMs && matches(ev);
    });

    const BLOB_H = 76;
    const PACK_H = 64;
    const GAP = 12;
    // Lane count and spacing are both derived from the height actually
    // available. The reference design floors them at 2 lanes / 108px, which is
    // fine on a desktop pane but silently draws a whole lane past the bottom of
    // a short one — a landscape phone loses roughly half its events to a clipped
    // region with no scrollbar to hint they're there.
    const TOP_OFFSET = 74;
    const BOTTOM_MARGIN = 14;
    const usable = Math.max(BLOB_H, H - TOP_OFFSET - BOTTOM_MARGIN);
    const LANES = Math.max(1, Math.min(4, Math.floor(usable / (BLOB_H + 16))));
    const laneH = LANES > 1 ? Math.max(BLOB_H + 10, (usable - BLOB_H) / (LANES - 1)) : 0;
    const laneY = (l: number) => Math.round(TOP_OFFSET + l * laneH);
    const laneRight: number[] = Array.from({ length: LANES }, () => -1e9);
    const sorted = [...inWindow].sort((a, b) => a.date.getTime() - b.date.getTime());
    const blobsOut: BlobShape[] = [];
    const packsOut: PackShape[] = [];
    // What each lane currently ends with, so an overflowing pack can absorb it
    // rather than being appended past the canvas edge (see below).
    const laneLast: Array<{ kind: "blob" | "pack"; idx: number; x: number; count: number; first: HistoryEvent } | null> = Array.from(
      { length: LANES },
      () => null,
    );
    const droppedBlobs = new Set<number>();
    const rightEdge = W - 8;
    const zoomInto = (first: HistoryEvent) => () => {
      setScale(scale === "year" ? "month" : scale === "month" ? "week" : "day");
      setTOffset(0);
      setSelectedId(first.id);
    };
    let ix = 0;
    while (ix < sorted.length) {
      const ev = sorted[ix]!;
      const x = xOf(ev.date);
      const n = ev.participants.length;
      const w = Math.max(104, 52 + n * 26);
      const left = x - w / 2;
      let lane = -1;
      for (let l = 0; l < LANES; l++) {
        if (laneRight[l]! + GAP <= left) {
          lane = l;
          break;
        }
      }
      if (lane < 0) {
        const group = [ev];
        ix++;
        while (ix < sorted.length && xOf(sorted[ix]!.date) - x < w) {
          group.push(sorted[ix]!);
          ix++;
        }
        let bl = 0;
        for (let l = 1; l < LANES; l++) if (laneRight[l]! < laneRight[bl]!) bl = l;
        const pw = 112;
        const y = laneY(bl);
        const naturalPx = Math.max(laneRight[bl]! + GAP, left);
        const prev = laneLast[bl];

        // A pack only exists because no lane had room, which makes it the
        // (lanes + 1)-th shape competing for one x — so appending it after the
        // lane's content always walks off the right edge. Instead it absorbs
        // whatever that lane already ends with and takes over its slot: the
        // count grows, the position stays on-canvas, and nothing overlaps.
        // This is what keeps dense, recent-heavy history readable, which is
        // precisely where events pile up in real use.
        if (naturalPx + pw > rightEdge && prev) {
          if (prev.kind === "pack") {
            const target = packsOut[prev.idx]!;
            prev.count += group.length;
            target.label = `${prev.count} ${t("timelineView.eventsCount")}`;
            continue;
          }
          droppedBlobs.add(prev.idx);
          const merged = prev.count + group.length;
          const px = Math.min(prev.x, rightEdge - pw);
          const first = prev.first;
          packsOut.push({
            x: Math.round(px),
            y,
            w: pw,
            h: PACK_H,
            cx: Math.round(px + pw / 2),
            ty: y + 38,
            label: `${merged} ${t("timelineView.eventsCount")}`,
            onZoomIn: zoomInto(first),
          });
          laneRight[bl] = px + pw;
          laneLast[bl] = { kind: "pack", idx: packsOut.length - 1, x: px, count: merged, first };
          continue;
        }

        const px = Math.min(naturalPx, Math.max(0, rightEdge - pw));
        const first = group[0]!;
        packsOut.push({
          x: Math.round(px),
          y,
          w: pw,
          h: PACK_H,
          cx: Math.round(px + pw / 2),
          ty: y + 38,
          label: `${group.length} ${t("timelineView.eventsCount")}`,
          onZoomIn: zoomInto(first),
        });
        laneRight[bl] = px + pw;
        laneLast[bl] = { kind: "pack", idx: packsOut.length - 1, x: px, count: group.length, first };
        continue;
      }
      const y = laneY(lane);
      const sel = selectedEvent?.id === ev.id;
      // A blob's caption sits above it and is wider than the blob itself, so
      // it has to be fitted to the canvas independently: pin it inside the
      // right edge, then trim the text to whatever room is actually left.
      // Without this the caption just runs off the canvas — SVG text neither
      // wraps nor clips — which is most visible exactly where events cluster,
      // i.e. at "now", the part of the timeline people look at most.
      const lx = Math.round(Math.min(Math.max(left + 4, 4), Math.max(4, W - 12)));
      const maxChars = Math.max(8, Math.floor((W - 8 - lx) / TITLE_CHAR_W));
      const titleLimit = Math.min(26, maxChars);
      blobsOut.push({
        id: ev.id,
        x: Math.round(left),
        y,
        w,
        h: BLOB_H,
        tint: KIND_STYLE[ev.kind].tint,
        color: KIND_STYLE[ev.kind].color,
        sw: sel ? 2.4 : 1.3,
        lx,
        ly: y - 19,
        ly2: y - 5,
        title: ev.rawText.length > titleLimit ? `${ev.rawText.slice(0, titleLimit - 1)}…` : ev.rawText,
        dateLabel: format(ev.date, "d MMM yy", { locale: dateLocale }),
        hasChildren: parentIds.has(ev.id),
        nodes: ev.participants.map((p, i) => ({
          cx: left + (w / (n + 1)) * (i + 1),
          cy: y + BLOB_H / 2 + (i % 2 ? 9 : -9),
          color: p.color,
        })),
        onSelect: () => pickEvent(ev.id),
      });
      laneRight[lane] = left + w;
      laneLast[lane] = { kind: "blob", idx: blobsOut.length - 1, x: Math.round(left), count: 1, first: ev };
      ix++;
    }
    return {
      blobs: droppedBlobs.size === 0 ? blobsOut : blobsOut.filter((_, i) => !droppedBlobs.has(i)),
      packs: packsOut,
    };
  }, [allEvents, startMs, endMs, W, H, matches, scale, selectedEvent?.id, dateLocale, t, xOf, parentIds, pickEvent]);

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
        setTOffset(Math.max(0, Math.round((nowMs - ev.date.getTime()) / DAY_MS / (SPANS.month * 0.5))));
      },
    }));
    return {
      from: format(new Date(allStart), "d MMM yy", { locale: dateLocale }),
      to: format(new Date(allEnd), "d MMM yy", { locale: dateLocale }),
      ticks,
      windowLeft: `${(Math.max(0, (startMs - allStart) / span) * 100).toFixed(2)}%`,
      windowWidth: `${(Math.min(1, (endMs - startMs) / span) * 100).toFixed(2)}%`,
    };
  }, [allEvents, startMs, endMs, nowMs, dateLocale, pickEvent]);

  const sidebarList = useMemo(() => allEvents.filter(matches).slice().reverse().slice(0, 26), [allEvents, matches]);

  // Scrubbing maps a position on the all-time strip back to a pan offset. The
  // strip is anchored at "now" on the right, and tOffset counts half-windows
  // backwards from it, which is what makes this a division by spanDays/2.
  const scrubberRef = useRef<HTMLDivElement>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const allSpan = useMemo(() => {
    if (allEvents.length === 0) return null;
    const from = allEvents[0]!.date.getTime();
    return { from, to: nowMs, span: Math.max(1, nowMs - from) };
  }, [allEvents, nowMs]);
  const scrubberFraction = allSpan ? Math.min(1, Math.max(0, (endMs - allSpan.from) / allSpan.span)) : 1;

  const scrubTo = useCallback(
    (clientX: number) => {
      const el = scrubberRef.current;
      if (!el || !allSpan) return;
      const rect = el.getBoundingClientRect();
      const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(1, rect.width)));
      const targetEnd = allSpan.from + fraction * allSpan.span;
      const halfWindowMs = SPANS[scale] * 0.5 * DAY_MS;
      setTOffset(Math.max(0, Math.round((nowMs - targetEnd) / halfWindowMs)));
    },
    [allSpan, scale, nowMs],
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
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center" style={{ background: "#F4F7FB" }}>
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
      <div className="flex h-full flex-col" style={{ background: "#F4F7FB" }}>
        {/* Phone-only pane switcher. The three columns are a desktop layout;
            on a phone they become three destinations. */}
        <div className="flex shrink-0 gap-1 border-b p-2 md:hidden" style={{ borderColor: "#DFE6F0", background: "#FBFCFE" }}>
          {(["list", "chart", "detail"] as const).map((pane) => (
            <button
              key={pane}
              onClick={() => setMobilePane(pane)}
              aria-pressed={mobilePane === pane}
              className={`h-10 flex-1 rounded-lg text-[12.5px] font-semibold transition-colors ${
                mobilePane === pane ? "text-white" : "text-[#5A6474]"
              }`}
              style={{ background: mobilePane === pane ? "#1B1D21" : "#fff", border: "1px solid #DDE5F0" }}
            >
              {pane === "list" ? t("historyGraph.paneList") : pane === "chart" ? t("historyGraph.paneChart") : t("historyGraph.paneDetail")}
            </button>
          ))}
        </div>

        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          {/* LEFT: events sidebar */}
          <div
            className={`${mobilePane === "list" ? "flex" : "hidden"} w-full flex-col gap-[13px] overflow-auto p-4 md:flex md:w-[240px] md:flex-none md:px-[14px] wide:w-[266px]`}
            style={{ background: "#FBFCFE", borderRight: "1px solid #DFE6F0", maxHeight: "100%" }}
          >
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t("historyGraph.sidebarTitle")}</div>
            <div style={{ fontSize: 11, color: "#7C8698", marginTop: 2 }}>
              {sidebarList.length} {t("historyGraph.eventsInView")}
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-[9px] border px-[10px] py-[7px]" style={{ background: "#fff", borderColor: "#DDE5F0" }}>
            <Search className="size-[13px] shrink-0" style={{ color: "#9AA4B4" }} />
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
                  className="relative cursor-pointer rounded-[11px] border px-[10px] py-[9px] hover:border-[#C9D4E4]"
                  style={{ borderColor: "#E2E8F2", background: "#fff", borderLeft: `3px solid ${KIND_STYLE[ev.kind].color}` }}
                >
                  {active && <div className="pointer-events-none absolute inset-0 rounded-[11px]" style={{ border: "1.5px solid #4E7FD4" }} />}
                  <div className="relative" style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>
                    {ev.rawText.length > 26 ? `${ev.rawText.slice(0, 25)}…` : ev.rawText}
                  </div>
                  <div className="relative flex items-center gap-[6px]" style={{ marginTop: 5, fontFamily: "var(--font-mono)", fontSize: 9.5, color: "#8C97A8" }}>
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
          <div className="mt-auto flex flex-col gap-[6px] border-t pt-3" style={{ borderColor: "#E4EAF3" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, letterSpacing: "0.09em", textTransform: "uppercase", color: "#93A0B2", marginBottom: 2 }}>
              {t("historyGraph.legendTitle")}
            </div>
            {(["MEETING", "CALL", "INTRO", "EMAIL", "WORKSHOP", "MEMO"] as InteractionType[]).map((kind) => (
              <div key={kind} className="flex items-center gap-[7px]" style={{ fontSize: 11, color: "#5A6474" }}>
                <div className="size-3 rounded shrink-0" style={{ border: `1.5px solid ${KIND_STYLE[kind].color}`, background: KIND_STYLE[kind].tint }} />
                {t(`interactionType.${kind}`)}
              </div>
            ))}
          </div>
        </div>

        {/* MAIN: header + canvas + scrubber */}
          <div className={`${mobilePane === "chart" ? "flex" : "hidden"} min-h-0 w-full min-w-0 flex-1 flex-col md:flex`}>
            <div className="flex flex-wrap items-center gap-3 px-4 py-3 md:gap-[14px] md:px-[22px] md:py-4" style={{ borderBottom: "1px solid #DFE6F0", background: "rgba(255,255,255,.72)" }}>
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
                      background: "#E4EDF9",
                      color: "#3F6299",
                    }}
                  >
                    {t("historyGraph.badge")}
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: "#7C8698", marginTop: 3 }}>{t("historyGraph.subtitle")}</div>
              </div>
              <div className="flex flex-1 gap-[5px] rounded-[10px] border p-1 md:ml-auto md:flex-none" style={{ background: "#fff", borderColor: "#DDE5F0" }}>
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
                      color: scale === s ? "#fff" : "#5A6474",
                      background: scale === s ? "#1B1D21" : "transparent",
                      border: "none",
                    }}
                  >
                    {t(`historyGraph.${s}`)}
                  </button>
                ))}
              </div>
              <div className="flex gap-1 rounded-[10px] border p-1" style={{ background: "#fff", borderColor: "#DDE5F0" }}>
                <button
                  onClick={() => setTOffset((o) => o + 1)}
                  aria-label={t("historyGraph.panBack")}
                  className="flex size-9 items-center justify-center rounded-[7px] hover:bg-[#F1F5FA] md:size-[26px]"
                  style={{ fontSize: 14, cursor: "pointer", color: "#5A6474", border: "none", background: "transparent" }}
                >
                  ←
                </button>
                <button
                  onClick={() => setTOffset(0)}
                  aria-label={t("historyGraph.jumpToNow")}
                  title={t("historyGraph.jumpToNow")}
                  disabled={tOffset === 0}
                  className="flex h-9 items-center justify-center rounded-[7px] px-2.5 text-[11.5px] font-semibold hover:bg-[#F1F5FA] disabled:opacity-35 md:h-[26px]"
                  style={{ cursor: "pointer", color: "#5A6474", border: "none", background: "transparent" }}
                >
                  {t("historyGraph.now")}
                </button>
                <button
                  onClick={() => setTOffset((o) => Math.max(0, o - 1))}
                  aria-label={t("historyGraph.panFwd")}
                  disabled={tOffset === 0}
                  className="flex size-9 items-center justify-center rounded-[7px] hover:bg-[#F1F5FA] disabled:opacity-35 md:size-[26px]"
                  style={{ fontSize: 14, cursor: "pointer", color: "#5A6474", border: "none", background: "transparent" }}
                >
                  →
                </button>
              </div>
              <button
                onClick={() => setDetailOpen((o) => !o)}
                aria-pressed={detailOpen}
                title={t("historyGraph.paneDetail")}
                className="hidden size-[26px] flex-none items-center justify-center rounded-[7px] border hover:bg-[#F1F5FA] md:flex wide:hidden"
                style={{ borderColor: "#DDE5F0", background: detailOpen ? "#EEF3FB" : "#fff", color: "#5A6474" }}
              >
                <PanelRight className="size-[13px]" />
              </button>
            </div>

            <div ref={canvasRef} className="relative flex-1 overflow-hidden">
              <svg width="100%" height="100%" className="absolute inset-0">
                {axisTicks.map((tick, i) => (
                  <g key={i}>
                    <line x1={tick.x} y1={34} x2={tick.x} y2={H} stroke="#E3EAF4" strokeWidth={1} />
                    <text x={tick.x} y={24} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={10.5} fill="#8C97A8">
                      {tick.label}
                    </text>
                  </g>
                ))}
                {packs.map((p, i) => (
                  <g key={i} onClick={p.onZoomIn} style={{ cursor: "zoom-in" }}>
                    <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={14} fill="#EAF0F8" stroke="#CFDBEB" strokeDasharray="4 4" />
                    <text x={p.cx} y={p.ty} textAnchor="middle" fontFamily="var(--font-sans)" fontSize={12} fontWeight={600} fill="#5A6474">
                      {p.label}
                    </text>
                  </g>
                ))}
                {blobs.map((b) => (
                  <g key={b.id} onClick={b.onSelect} style={{ cursor: "pointer" }}>
                    <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={26} fill={b.tint} stroke={b.color} strokeWidth={b.sw} />
                    {b.nodes.map((n, i) => (
                      <path key={i} d={shapeD("person", 11)} transform={`translate(${n.cx},${n.cy})`} fill={n.color} stroke="#fff" strokeWidth={1.4} />
                    ))}
                    <text x={b.lx} y={b.ly} fontFamily="var(--font-sans)" fontSize={12} fontWeight={600} fill="#3E4756">
                      {b.title}
                    </text>
                    <text x={b.lx} y={b.ly2} fontFamily="var(--font-mono)" fontSize={10} fill="#8C97A8">
                      {b.dateLabel}
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
                <line x1={0} y1={34} x2={W} y2={34} stroke="#CFDBEB" strokeWidth={1} />
              </svg>
            </div>

            <div className="flex h-[86px] flex-none flex-col gap-[6px] px-4 py-[10px] md:h-[78px] md:px-[22px]" style={{ borderTop: "1px solid #DFE6F0", background: "rgba(255,255,255,.66)" }}>
              <div className="flex justify-between gap-2" style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "#93A0B2" }}>
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
                style={{ background: "#fff", borderColor: "#DDE5F0" }}
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
                    style={{ background: "rgba(78,127,212,.14)", border: "1.5px solid #4E7FD4", left: scrubber.windowLeft, width: scrubber.windowWidth }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: detail panel. At >= 1300 it is a static third column beside
              the canvas. Between 768 and 1299 there is no room for a third
              column, so it becomes an overlay anchored to the right edge of the
              row — which is why it needs its own dismiss state rather than only
              clearing the selection. Below 768 it is one of the three panes. */}
          {selectedEvent && (
            <div
              className={[
                "w-full flex-col gap-[14px] overflow-auto p-[18px]",
                mobilePane === "detail" ? "flex" : "hidden",
                detailOpen ? "md:flex" : "md:hidden",
                "md:absolute md:inset-y-0 md:right-0 md:z-30 md:w-[320px] md:shadow-[-8px_0_24px_-12px_rgba(27,29,33,.28)]",
                "wide:static wide:flex wide:w-[314px] wide:flex-none wide:shadow-none",
              ].join(" ")}
              style={{ background: "#fff", borderLeft: "1px solid #DFE6F0", maxHeight: "100%" }}
            >
                  <div className="flex items-start gap-[10px]">
                    <div
                      className="size-[34px] flex-none rounded-[11px]"
                      style={{ border: `1.5px solid ${KIND_STYLE[selectedEvent.kind].color}`, background: KIND_STYLE[selectedEvent.kind].tint }}
                    />
                    <div className="min-w-0 flex-1">
                      <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.3 }}>{selectedEvent.entityLabelStr}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#8C97A8", marginTop: 3 }}>
                        {format(selectedEvent.date, "d MMM yy", { locale: dateLocale })} · {t(`interactionType.${selectedEvent.kind}`)}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedId(null);
                        setDetailOpen(false);
                      }}
                      aria-label={t("cluster.expand.close")}
                      className="flex size-7 flex-none items-center justify-center rounded-md hover:bg-[#F1F5FA]"
                      style={{ fontSize: 13, color: "#A6AEBB", cursor: "pointer", background: "none", border: "none" }}
                    >
                      ✕
                    </button>
                  </div>

                  {parentEvent && (
                    <button
                      onClick={() => setSelectedId(parentEvent.id)}
                      className="flex items-center gap-1 text-left hover:opacity-80"
                      style={{ fontSize: 10.5, color: "#8C97A8", background: "none", border: "none", cursor: "pointer" }}
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
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.09em", textTransform: "uppercase", color: "#93A0B2", marginBottom: 8 }}>
                      {t("historyGraph.notes")}
                    </div>
                    <div
                      className="whitespace-pre-wrap"
                      style={{ fontSize: 12.5, lineHeight: 1.55, color: "#3E4756", background: "#F7FAFD", border: "1px solid #E4EBF4", borderRadius: 11, padding: "11px 12px" }}
                    >
                      {selectedEvent.rawText}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.09em", textTransform: "uppercase", color: "#93A0B2", marginBottom: 8 }}>
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
                          className={`flex items-center gap-[9px] rounded-[10px] border px-[9px] py-2 ${p.isMe ? "" : "cursor-pointer hover:bg-[#F7FAFD]"}`}
                          style={{ borderColor: "#E9EEF6" }}
                        >
                          <div className="size-[9px] shrink-0 rounded-full" style={{ background: p.color }} />
                          <div className="min-w-0">
                            <div className="truncate" style={{ fontSize: 12, fontWeight: 600 }}>
                              {p.name}
                            </div>
                            {p.category && <div style={{ fontSize: 10.5, color: "#8C97A8" }}>{t(`category.${p.category}`)}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {touchedRelationships.length > 0 && (
                    <div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.09em", textTransform: "uppercase", color: "#93A0B2", marginBottom: 8 }}>
                        {t("historyGraph.touchedRelationships")}
                      </div>
                      <div className="flex flex-col gap-[6px]">
                        {touchedRelationships.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => router.push(`/network?focus=${c.fromContactId}`)}
                            onMouseDown={(e) => e.preventDefault()}
                            className="flex items-center gap-[7px] rounded-[10px] border px-[9px] py-[7px] text-left hover:bg-[#F7FAFD]"
                            style={{ borderColor: "#E9EEF6", cursor: "pointer", background: "none" }}
                          >
                            <span className="min-w-0 flex-1 truncate" style={{ fontSize: 11.5 }}>
                              {c.fromName} ↔ {c.toName}
                            </span>
                            {c.relationship && (
                              <span
                                className="shrink-0 truncate"
                                style={{ fontSize: 9.5, fontWeight: 600, padding: "2px 6px", borderRadius: 20, background: "#F1F5FA", color: "#5A6474", maxWidth: 90 }}
                              >
                                {c.relationship}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => setWorkflowOpen(true)}
                    className="cursor-pointer rounded-[10px] text-center"
                    style={{ padding: "9px 12px", background: "#1B1D21", color: "#fff", fontSize: 11.5, fontWeight: 600, border: "none" }}
                  >
                    {t("historyGraph.openFullHistory")}
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
    </>
  );
}
