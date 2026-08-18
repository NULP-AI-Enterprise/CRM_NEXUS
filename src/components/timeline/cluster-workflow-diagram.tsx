"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { format } from "date-fns";
import { uk, enUS } from "date-fns/locale";
import { Crosshair, GitBranch, Loader2, Maximize2, Minus, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { BranchParentPicker, invalidateBranchParentCache } from "@/components/timeline/branch-parent-picker";
import { useTranslation } from "@/lib/i18n/context";
import { INTERACTION_TYPE_LABELS } from "@/lib/contact-display";
import type { ClusterDiagramData } from "@/lib/data/cluster";
import { entityLabel, type TimelineEvent } from "@/lib/timeline-entity";

const ROW_HEIGHT = 92;
const COLUMN_WIDTH = 208;
const TOP_MARGIN = 52;
const SVG_LEFT_PADDING = 28;
const SVG_RIGHT_PADDING = 40;
const NODE_W = 178;
const NODE_H = 46;
const NODE_PAD_X = 12;
/** Character budgets for the two lines inside a node box, derived from its
 * inner width at each line's font size. SVG text does not wrap or clip, so
 * anything longer would simply spill over the box and onto its neighbours.
 * The per-character figures are deliberately pessimistic — Cyrillic and the
 * "↔" separator both run wider than a Latin average would suggest. */
const TITLE_CHARS = Math.floor((NODE_W - NODE_PAD_X * 2) / 6.4);
const META_CHARS = Math.floor((NODE_W - NODE_PAD_X * 2) / 5.5);
const MAIN_INK = "#1B1D21";

/** Palette by depth — main line reads as the trunk, each hop away from it
 * gets its own hue so a long X→Y→N chain stays followable. */
const DEPTH_COLORS = ["#1B1D21", "#5B8DEF", "#9B7BE0", "#E9A15F", "#43A883"];
const depthColor = (d: number) => DEPTH_COLORS[Math.min(d, DEPTH_COLORS.length - 1)]!;

/** An event I was personally in — the app only ever attaches an interaction to
 * a single Contact when it's "me and them", so contact-attached is exactly
 * "I was there". Connection-attached means two other people talked. */
function isDirect(event: TimelineEvent): boolean {
  return event.entity.kind === "contact";
}

type LinkKind = "branch" | "merge" | "continues";

/** Columns follow chronology, so a link normally runs left-to-right. It can
 * run backwards once an event is re-pointed at a parent logged after it —
 * a plain cubic then doubles back through its own start and reads as a
 * scribble. Route those under the rows instead, which states plainly that
 * this link runs against the timeline. */
function edgePath(x1: number, y1: number, x2: number, y2: number): string {
  if (x2 >= x1) {
    const mid = x1 + (x2 - x1) / 2;
    return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
  }
  const under = Math.max(y1, y2) + 34;
  return `M ${x1} ${y1} C ${x1 + 34} ${y1}, ${x1 + 34} ${under}, ${x1} ${under} L ${x2} ${under} C ${x2 - 34} ${under}, ${x2 - 34} ${y2}, ${x2} ${y2}`;
}

/** Where to POST a new branch off `event` — reuses the exact same endpoints
 * every other logging form in this app already uses, just with
 * `parentInteractionId` set, so branches behave identically to any other
 * interaction (AI re-profiling included for contact-attached ones). */
function branchTarget(event: TimelineEvent): { url: string; body: (rawText: string) => Record<string, unknown> } {
  if (event.entity.kind === "contact") {
    return {
      url: "/api/process-interaction",
      body: (rawText) => ({ rawText, contactId: event.entity.kind === "contact" ? event.entity.contact.id : "", parentInteractionId: event.id }),
    };
  }
  return {
    url: `/api/connections/${event.entity.connection.id}/interactions`,
    body: (rawText) => ({ rawText, parentInteractionId: event.id }),
  };
}

interface View {
  x: number;
  y: number;
  k: number;
}
interface Framed {
  svgWidth: number;
  svgHeight: number;
  nodes: Array<{ event: { id: string }; cx: number; cy: number }>;
}

const MIN_K = 0.25;
const MAX_K = 2.5;

/** Frame the whole diagram. Never scales past 1: blowing a two-event chain up
 * to fill a 1200px dialog looks broken, so small graphs sit centred at their
 * natural size instead. */
function fitView(layout: Framed, width: number, height: number): View {
  const pad = 24;
  const k = Math.max(MIN_K, Math.min(1, (width - pad * 2) / layout.svgWidth, (height - pad * 2) / layout.svgHeight));
  return { k, x: (width - layout.svgWidth * k) / 2, y: (height - layout.svgHeight * k) / 2 };
}

/** Put one event in the middle of the viewport at scale `k`. */
function centerView(layout: Framed, width: number, height: number, eventId: string, k: number): View | null {
  const node = layout.nodes.find((n) => n.event.id === eventId);
  if (!node) return null;
  return { k, x: width / 2 - node.cx * k, y: height / 2 - node.cy * k };
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function ClusterWorkflowDiagram({
  open,
  onOpenChange,
  entityKey,
  initialEventId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityKey: string | null;
  /** Jump straight to this event's expansion once loaded — set when the
   * trigger was clicking a specific event row, not just the lane's icon. */
  initialEventId?: string | null;
}) {
  const { t, locale } = useTranslation();
  const dateLocale = locale === "uk" ? uk : enUS;
  const [data, setData] = useState<ClusterDiagramData | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isEditingText, setIsEditingText] = useState(false);
  const [editText, setEditText] = useState("");
  const [editType, setEditType] = useState("");
  const [editDate, setEditDate] = useState("");
  const [isAddingBranch, setIsAddingBranch] = useState(false);
  const [branchDraft, setBranchDraft] = useState("");
  const [isRelinking, setIsRelinking] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  /** Viewport over the diagram: `k` scales, `x`/`y` translate, both in
   * container pixels. A long chain is far wider than any dialog — 208px per
   * column means a 30-event history is ~6300px — so native scrolling alone
   * left no way to see the shape of the thing, only a keyhole onto it. */
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  /** Set while a drag is in flight; read by the node click handler so that
   * finishing a pan on top of a node doesn't also select it. */
  const panRef = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      setViewportSize((prev) =>
        Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - height) < 0.5 ? prev : { width, height },
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  const refetch = useCallback(() => {
    if (!entityKey) return;
    fetch(`/api/timeline/cluster?entityKey=${encodeURIComponent(entityKey)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load");
        return res.json() as Promise<ClusterDiagramData>;
      })
      .then((json) => {
        setData(json);
        setError(null);
        setFetchedAt(Date.now());
        setLoadedKey(entityKey);
      })
      .catch(() => {
        setError(t("cluster.loadError"));
        setLoadedKey(entityKey);
      });
  }, [entityKey, t]);

  useEffect(() => {
    if (!open || !entityKey) return;
    let cancelled = false;

    fetch(`/api/timeline/cluster?entityKey=${encodeURIComponent(entityKey)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load");
        return res.json() as Promise<ClusterDiagramData>;
      })
      .then((json) => {
        if (cancelled) return;
        setData(json);
        setError(null);
        setFetchedAt(Date.now());
        setLoadedKey(entityKey);
        setSelectedEventId(initialEventId ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setError(t("cluster.loadError"));
        setLoadedKey(entityKey);
      });

    return () => {
      cancelled = true;
    };
  }, [open, entityKey, initialEventId, t]);

  // Loading whenever we haven't yet resolved a fetch for the currently-requested
  // key — also true immediately after switching to a new entityKey, before the
  // effect above even runs, so stale data for a previous key never flashes.
  const isLoading = open && entityKey != null && loadedKey !== entityKey;
  const isCurrent = open && entityKey != null && loadedKey === entityKey;

  const layout = useMemo(() => {
    if (!data) return null;

    const events = data.events;
    const byId = new Map(events.map((e) => [e.id, e]));

    // Depth = how far removed an event is from me, which is what the vertical
    // axis encodes (main line on top, every hop away sinks one row lower):
    //   * I was in it -> main line, whatever it came from. Reaching me is what
    //     closes a chain, so this is also how a merge arises ("X introduced me
    //     to Y" finally lands as *my* meeting with Y).
    //   * I wasn't in it -> at least one level down, and one level below
    //     whatever it came from, so X->Y->N keeps descending.
    // Memoised, with an in-progress guard so a cycle (only reachable through
    // hand-edited data) terminates instead of blowing the stack.
    const depthCache = new Map<string, number>();
    const resolving = new Set<string>();
    const depthOf = (event: TimelineEvent): number => {
      const cached = depthCache.get(event.id);
      if (cached !== undefined) return cached;
      if (isDirect(event)) {
        depthCache.set(event.id, 0);
        return 0;
      }
      if (resolving.has(event.id)) return 1;
      resolving.add(event.id);

      const parent = event.parentInteractionId ? byId.get(event.parentInteractionId) : undefined;
      const depth = parent ? depthOf(parent) + 1 : 1;

      resolving.delete(event.id);
      depthCache.set(event.id, depth);
      return depth;
    };

    const nodes = events.map((event, index) => {
      const depth = depthOf(event);
      const x = SVG_LEFT_PADDING + index * COLUMN_WIDTH;
      const y = TOP_MARGIN + depth * ROW_HEIGHT;
      return {
        event,
        depth,
        x,
        y,
        cx: x + NODE_W / 2,
        cy: y + NODE_H / 2,
        color: depthColor(depth),
        parties: entityLabel(event.entity),
        label: truncate(event.rawText, TITLE_CHARS),
        meta: truncate(
          `${format(new Date(event.createdAt), "d MMM", { locale: dateLocale })} · ${entityLabel(event.entity)}`,
          META_CHARS,
        ),
      };
    });
    const nodeById = new Map(nodes.map((n) => [n.event.id, n]));

    // The trunk: consecutive main-line events joined left-to-right, so the
    // "spine" reads as one continuous history even where branches dip below it.
    const mainNodes = nodes.filter((n) => n.depth === 0);
    const spine = mainNodes.slice(0, -1).map((from, i) => {
      const to = mainNodes[i + 1]!;
      return { id: `${from.event.id}->${to.event.id}`, x1: from.x + NODE_W, y1: from.cy, x2: to.x, y2: to.cy };
    });

    // Every node is classified exactly once, so none can fall through the
    // cracks and render with no attachment at all — which is what made a
    // parentless indirect event look like a rendering bug rather than simply
    // an event nobody has linked yet.
    //   linked  — parent resolves: draw the real edge.
    //   broken  — parent is set but outside this cluster: say so, don't guess.
    //   root    — genuinely unlinked: terminate it like a git initial commit.
    // Deliberately absent: any "probably came from…" edge. Guessing provenance
    // from shared participants or recency would draw a causal claim the data
    // does not make, in a tool whose whole job is remembering what actually
    // happened between real people.
    const links: Array<{ id: string; kind: LinkKind; color: string; x1: number; y1: number; x2: number; y2: number }> = [];
    const terminators: Array<{ id: string; kind: "root" | "broken"; x: number; y: number; color: string }> = [];

    const mainIds = new Set(mainNodes.map((n) => n.event.id));
    const spineFollowsFirst = mainNodes.length > 0 ? mainNodes[0]!.event.id : null;

    for (const n of nodes) {
      const parent = n.event.parentInteractionId ? nodeById.get(n.event.parentInteractionId) : undefined;
      if (parent) {
        // Three distinct relationships, three distinct readings. Lumping the
        // equal-depth case in with "merge" claimed a chain had come back to me
        // when it had merely continued on the row it was already on.
        const kind: LinkKind = n.depth > parent.depth ? "branch" : n.depth < parent.depth ? "merge" : "continues";
        links.push({
          id: n.event.id,
          kind,
          color: depthColor(Math.max(n.depth, parent.depth)),
          x1: parent.x + NODE_W,
          y1: parent.cy,
          x2: n.x,
          y2: n.cy,
        });
        continue;
      }
      // A main-line node other than the very first is already visibly carried
      // by the trunk, so it needs no extra marker.
      const carriedBySpine = mainIds.has(n.event.id) && n.event.id !== spineFollowsFirst;
      if (carriedBySpine) continue;
      terminators.push({
        id: n.event.id,
        kind: n.event.parentInteractionId ? "broken" : "root",
        x: n.x,
        y: n.cy,
        color: n.event.parentInteractionId ? "#E9A15F" : depthColor(n.depth),
      });
    }

    const gridlines: Array<{ x: number; label: string }> = [];
    let lastMonth: string | null = null;
    events.forEach((event, index) => {
      const key = monthKey(event.createdAt);
      if (key !== lastMonth) {
        lastMonth = key;
        gridlines.push({
          x: SVG_LEFT_PADDING + index * COLUMN_WIDTH,
          label: format(new Date(event.createdAt), "LLL yyyy", { locale: dateLocale }),
        });
      }
    });

    // Pinned to the right of the event it belongs to, not parked in a shared
    // column at the far right — where every marker at the same depth landed on
    // identical coordinates and stacked invisibly, detached from its own event.
    const futureMarkers = nodes
      .filter((n) => n.event.followUpDate && new Date(n.event.followUpDate).getTime() > fetchedAt)
      .map((n) => ({ event: n.event, anchorX: n.x + NODE_W, x: n.x + NODE_W + 15, y: n.cy, color: n.color }));

    const maxDepth = nodes.reduce((m, n) => Math.max(m, n.depth), 0);
    // No spare column for follow-ups any more: they sit in the gap beside
    // their own event, well inside SVG_RIGHT_PADDING.
    const totalColumns = Math.max(events.length, 1);
    const svgWidth = SVG_LEFT_PADDING + (totalColumns - 1) * COLUMN_WIDTH + NODE_W + SVG_RIGHT_PADDING;
    const svgHeight = TOP_MARGIN + (maxDepth + 1) * ROW_HEIGHT + 24;

    return { nodes, spine, links, terminators, gridlines, futureMarkers, maxDepth, svgWidth, svgHeight };
  }, [data, fetchedAt, dateLocale]);

  const selectedEvent = useMemo(
    () => data?.events.find((e) => e.id === selectedEventId) ?? null,
    [data, selectedEventId],
  );
  const parentEvent = useMemo(
    () => (selectedEvent?.parentInteractionId ? data?.events.find((e) => e.id === selectedEvent.parentInteractionId) ?? null : null),
    [data, selectedEvent],
  );
  const selectedEventChildren = useMemo(
    () => (selectedEventId ? (data?.events.filter((e) => e.parentInteractionId === selectedEventId) ?? []) : []),
    [data, selectedEventId],
  );

  const selectEvent = (id: string) => {
    // A pan that happens to end over a node is not a click on it.
    if (panRef.current?.moved) return;
    setSelectedEventId(id);
    setIsEditingText(false);
    setIsAddingBranch(false);
    setIsRelinking(false);
  };

  // ---- viewport controls -------------------------------------------------

  const fitToView = useCallback(() => {
    if (!layout || !viewportSize.width || !viewportSize.height) return;
    setView(fitView(layout, viewportSize.width, viewportSize.height));
  }, [layout, viewportSize.width, viewportSize.height]);

  /** Bring an event to the middle of the viewport — used when the diagram is
   * opened from a specific event, which previously selected that node and then
   * left it somewhere off-screen. */
  const centerOn = useCallback(
    (eventId: string) => {
      if (!layout || !viewportSize.width) return;
      setView((v) => centerView(layout, viewportSize.width, viewportSize.height, eventId, v.k) ?? v);
    },
    [layout, viewportSize.width, viewportSize.height],
  );

  /** Scale about a fixed point in container space, so the graph grows out of
   * wherever the user is pointing rather than drifting toward a corner. */
  const zoomAbout = useCallback((px: number, py: number, factor: number) => {
    setView((v) => {
      const k = Math.max(MIN_K, Math.min(MAX_K, v.k * factor));
      if (k === v.k) return v;
      return { k, x: px - ((px - v.x) / v.k) * k, y: py - ((py - v.y) / v.k) * k };
    });
  }, []);

  const zoomByButton = (factor: number) =>
    zoomAbout(viewportSize.width / 2, viewportSize.height / 2, factor);

  const handleViewportWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey && Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      // Horizontal trackpad flicks read as "scroll along the timeline".
      setView((v) => ({ ...v, x: v.x - e.deltaX }));
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    zoomAbout(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.12 : 1 / 1.12);
  };

  const handleViewportPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    panRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic pointers in tests have no capture target */
    }
  };

  const handleViewportPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = panRef.current;
    if (!p || p.id !== e.pointerId) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    // A few pixels of travel is a click with a shaky hand, not a drag.
    if (!p.moved && Math.hypot(dx, dy) < 4) return;
    p.moved = true;
    p.x = e.clientX;
    p.y = e.clientY;
    setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
  };

  const endPan = (e: React.PointerEvent<HTMLDivElement>) => {
    if (panRef.current?.id !== e.pointerId) return;
    // Cleared on the next frame so the click that follows this pointerup can
    // still see that a drag happened.
    const p = panRef.current;
    requestAnimationFrame(() => {
      if (panRef.current === p) panRef.current = null;
    });
  };

  // Frame the graph once per loaded dataset, as soon as the viewport has a real
  // size. Done as a render-time state adjustment rather than in an effect so
  // the first paint is already framed — an effect would show one frame of the
  // graph parked at the origin first. Deliberately not re-run on resize, which
  // would throw away a zoom the user set on purpose; Fit covers that.
  const [framedFor, setFramedFor] = useState<string | null>(null);
  const frameStamp = layout && viewportSize.width >= 1 ? `${loadedKey}:${fetchedAt}` : null;
  if (frameStamp && layout && framedFor !== frameStamp) {
    setFramedFor(frameStamp);
    const initial =
      (initialEventId && centerView(layout, viewportSize.width, viewportSize.height, initialEventId, 1)) ||
      fitView(layout, viewportSize.width, viewportSize.height);
    setView(initial);
  }

  /** Re-point (or clear, with null) which event this one branches from — the
   * only way to correct a wrong link without deleting and re-logging. The
   * server rejects loops; surface that verbatim rather than a generic error,
   * since "you picked a descendant" is actionable and nothing else here is. */
  const handleRelink = (parentId: string | null) => {
    if (!selectedEvent) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/interactions/${selectedEvent.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parentInteractionId: parentId }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? undefined);
        }
        setIsRelinking(false);
        refetch();
      } catch (err) {
        toast.error(err instanceof Error && err.message ? err.message : t("cluster.expand.saveError"));
      }
    });
  };

  const handleSaveText = () => {
    if (!selectedEvent || !editText.trim()) return;
    startTransition(async () => {
      try {
        const body: any = { rawText: editText.trim() };
        if (editType) body.type = editType;
        if (editDate) {
          const d = new Date(editDate);
          if (!isNaN(d.getTime())) body.createdAt = d.toISOString();
        }
        const res = await fetch(`/api/interactions/${selectedEvent.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error();
        setIsEditingText(false);
        refetch();
      } catch {
        toast.error(t("cluster.expand.saveError"));
      }
    });
  };

  const handleDelete = async () => {
    if (!selectedEvent) return;
    try {
      const res = await fetch(`/api/interactions/${selectedEvent.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setSelectedEventId(null);
      refetch();
    } catch {
      toast.error(t("cluster.expand.deleteError"));
    }
  };

  const handleAddBranch = () => {
    if (!selectedEvent || !branchDraft.trim()) return;
    const target = branchTarget(selectedEvent);
    startTransition(async () => {
      try {
        const res = await fetch(target.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(target.body(branchDraft.trim())),
        });
        if (!res.ok) throw new Error();
        setBranchDraft("");
        setIsAddingBranch(false);
        invalidateBranchParentCache();
        refetch();
      } catch {
        toast.error(t("cluster.expand.saveError"));
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[88dvh] w-[96vw] max-w-[96vw] flex-col p-3 sm:max-w-[95vw] sm:p-4">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold text-foreground">{t("cluster.title")}</DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="flex flex-1 items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t("cluster.loading")}
          </div>
        )}

        {isCurrent && error && (
          <div className="flex flex-1 items-center justify-center text-xs text-destructive">{error}</div>
        )}

        {isCurrent && !error && layout && (
          <>
            <div className="flex flex-wrap items-center gap-4 pb-2 text-[11px] text-muted-foreground shrink-0">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-4 rounded-sm" style={{ background: MAIN_INK }} />
                {t("cluster.legend.mainLine")}
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="18" height="10" aria-hidden>
                  <path d="M 0 2 C 8 2, 10 8, 18 8" fill="none" stroke={depthColor(1)} strokeWidth={1.6} strokeDasharray="4 3" />
                </svg>
                {t("cluster.legend.branchDown")}
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="18" height="10" aria-hidden>
                  <path d="M 0 8 C 8 8, 10 2, 16 2" fill="none" stroke={depthColor(1)} strokeWidth={2} />
                  <path d="M 11 -1 L 18 2 L 11 5 Z" fill={depthColor(1)} />
                </svg>
                {t("cluster.legend.mergeUp")}
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="18" height="12" aria-hidden>
                  <line x1="1" y1="6" x2="17" y2="6" stroke={MAIN_INK} strokeWidth={1.6} opacity={0.85} />
                  <line x1="1" y1="1" x2="1" y2="11" stroke={MAIN_INK} strokeWidth={2.2} opacity={0.85} />
                </svg>
                {t("cluster.legend.root")}
              </span>
              <span className="flex items-center gap-1.5">
                <GitBranch className="size-3" />
                {t("cluster.expand.addBranch")}
              </span>
            </div>

            {layout.nodes.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
                {t("cluster.empty")}
              </div>
            ) : (
              <div className="flex flex-1 min-h-0 flex-col gap-2.5">
                <div
                  ref={viewportRef}
                  onWheel={handleViewportWheel}
                  onPointerDown={handleViewportPointerDown}
                  onPointerMove={handleViewportPointerMove}
                  onPointerUp={endPan}
                  onPointerCancel={endPan}
                  className="relative min-h-0 flex-1 cursor-grab touch-none overflow-hidden rounded-lg border border-border bg-background active:cursor-grabbing"
                >
                    <svg width="100%" height="100%" className="block">
                      <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
                      {/* One guide per depth: the trunk reads solid, each level
                          away from it is fainter, so "how far from me" is legible
                          even before following a single connector. */}
                      {Array.from({ length: layout.maxDepth + 1 }, (_, d) => (
                        <g key={d}>
                          <line
                            x1={0}
                            x2={layout.svgWidth}
                            y1={TOP_MARGIN + d * ROW_HEIGHT + NODE_H / 2}
                            y2={TOP_MARGIN + d * ROW_HEIGHT + NODE_H / 2}
                            stroke={d === 0 ? MAIN_INK : "var(--border)"}
                            strokeWidth={1}
                            opacity={d === 0 ? 0.18 : 0.7}
                            strokeDasharray={d === 0 ? undefined : "3 4"}
                          />
                          <text
                            x={6}
                            y={TOP_MARGIN + d * ROW_HEIGHT - 8}
                            fontSize={9}
                            className="select-none font-mono"
                            fill={depthColor(d)}
                            opacity={0.75}
                          >
                            {d === 0 ? t("cluster.mainLine") : `${t("cluster.depthLevel")} ${d}`}
                          </text>
                        </g>
                      ))}

                      {layout.gridlines.map((g) => (
                        <g key={g.x}>
                          <line
                            x1={g.x}
                            x2={g.x}
                            y1={TOP_MARGIN - 20}
                            y2={layout.svgHeight}
                            stroke="var(--border)"
                            strokeWidth={1}
                            strokeDasharray="2 3"
                          />
                          <text x={g.x} y={16} fontSize={10} className="fill-muted-foreground font-mono">
                            {g.label}
                          </text>
                        </g>
                      ))}

                      {/* The trunk — consecutive main-line events joined so the
                          history reads as one continuous line under the branches. */}
                      {layout.spine.map((s) => (
                        <line key={s.id} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={MAIN_INK} strokeWidth={2} opacity={0.85} />
                      ))}

                      {/* Branch (descending) and merge (ascending) connectors. A
                          merge is drawn solid and arrow-headed: it's the moment a
                          chain someone else was running finally reaches me. */}
                      {layout.links.map((l) => (
                        <g key={l.id}>
                          <path
                            d={edgePath(l.x1, l.y1, l.x2, l.y2)}
                            fill="none"
                            stroke={l.color}
                            strokeWidth={l.kind === "merge" ? 2 : 1.6}
                            strokeDasharray={l.kind === "branch" ? "4 3" : undefined}
                            opacity={l.kind === "branch" ? 0.65 : 0.9}
                          />
                          {l.kind === "merge" && (
                            <path d={`M ${l.x2 - 7} ${l.y2 - 4} L ${l.x2} ${l.y2} L ${l.x2 - 7} ${l.y2 + 4} Z`} fill={l.color} opacity={0.9} />
                          )}
                        </g>
                      ))}

                      {/* Terminators — git's initial-commit idiom. A node with
                          nothing feeding it gets a capped stub instead of
                          floating in space: it reads as "this is where this
                          thread starts", which is a claim the data supports.
                          Amber means the parent exists but lives outside this
                          cluster, so the gap is stated rather than hidden. */}
                      {layout.terminators.map((tm) => (
                        <g key={`term-${tm.id}`}>
                          <title>{tm.kind === "broken" ? t("cluster.terminator.broken") : t("cluster.terminator.root")}</title>
                          <line
                            x1={tm.x - 18}
                            y1={tm.y}
                            x2={tm.x}
                            y2={tm.y}
                            stroke={tm.color}
                            strokeWidth={1.6}
                            strokeDasharray={tm.kind === "broken" ? "3 3" : undefined}
                            opacity={0.85}
                          />
                          <line x1={tm.x - 18} y1={tm.y - 6} x2={tm.x - 18} y2={tm.y + 6} stroke={tm.color} strokeWidth={2.2} opacity={0.85} />
                        </g>
                      ))}

                      {layout.nodes.map((n) => {
                        const selected = selectedEventId === n.event.id;
                        return (
                          <g key={n.event.id} style={{ cursor: "pointer" }} onClick={() => selectEvent(n.event.id)}>
                            <title>
                              {`${t(`interactionType.${n.event.type}`)} · ${format(new Date(n.event.createdAt), "d MMM yyyy", { locale: dateLocale })}\n${n.parties}\n${n.event.rawText}`}
                            </title>
                            <rect
                              x={n.x}
                              y={n.y}
                              width={NODE_W}
                              height={NODE_H}
                              rx={9}
                              fill="var(--card)"
                              stroke={n.color}
                              strokeWidth={selected ? 2.2 : 1.2}
                            />
                            {/* Depth stripe: filled on the main line (I was there),
                                hollow further out (logged about other people). */}
                            <rect x={n.x} y={n.y} width={4} height={NODE_H} rx={2} fill={n.color} opacity={n.depth === 0 ? 1 : 0.55} />
                            <text x={n.x + NODE_PAD_X} y={n.y + 19} fontSize={11} fontWeight={600} className="select-none" fill="var(--foreground)">
                              {n.label}
                            </text>
                            <text x={n.x + NODE_PAD_X} y={n.y + 34} fontSize={9} className="select-none font-mono" fill="var(--muted-foreground)">
                              {n.meta}
                            </text>
                          </g>
                        );
                      })}

                      {layout.futureMarkers.map(({ event, anchorX, x, y, color }) => (
                        <g key={`fu-${event.id}`} style={{ cursor: "pointer" }} onClick={() => selectEvent(event.id)}>
                          <title>
                            {`${t("cluster.upcoming")} · ${event.followUpDate ? format(new Date(event.followUpDate), "d MMM yyyy", { locale: dateLocale }) : ""}\n${event.followUp ?? ""}`}
                          </title>
                          <line x1={anchorX} y1={y} x2={x - 7} y2={y} stroke={color} strokeWidth={1.2} strokeDasharray="2.5 2" opacity={0.7} />
                          <circle cx={x} cy={y} r={7} fill="var(--card)" stroke={color} strokeWidth={1.5} strokeDasharray="2.5 2" />
                        </g>
                      ))}
                      </g>
                    </svg>

                    {/* Viewport controls, bottom-left over the canvas — the same
                        placement and pill shape the relationship graph uses, so
                        the two graph surfaces are operated the same way. */}
                    <div
                      className="absolute bottom-3 left-3 z-10 flex items-center gap-0.5 rounded-lg border border-border bg-card/95 p-1 shadow-sm"
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => zoomByButton(1 / 1.25)}
                        aria-label={t("cluster.view.zoomOut")}
                        className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="min-w-11 text-center font-mono text-[10.5px] text-muted-foreground tabular-nums">
                        {Math.round(view.k * 100)}%
                      </span>
                      <button
                        onClick={() => zoomByButton(1.25)}
                        aria-label={t("cluster.view.zoomIn")}
                        className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Plus className="size-3.5" />
                      </button>
                      <span className="mx-0.5 h-4 w-px bg-border" />
                      <button
                        onClick={fitToView}
                        className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Maximize2 className="size-3.5" />
                        {t("cluster.view.fit")}
                      </button>
                      <button
                        onClick={() => selectedEventId && centerOn(selectedEventId)}
                        disabled={!selectedEventId}
                        title={t("cluster.view.centerSelected")}
                        aria-label={t("cluster.view.centerSelected")}
                        className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-35"
                      >
                        <Crosshair className="size-3.5" />
                      </button>
                    </div>
                </div>

                {/* Inline expansion — click any dot to describe it further, edit it, or grow a branch from it. */}
                {selectedEvent && (
                  <div className="shrink-0 rounded-lg border border-border bg-card p-3 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span className="font-mono">{format(new Date(selectedEvent.createdAt), "d MMM yyyy", { locale: dateLocale })}</span>
                          <span className="rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground">
                            {t(`interactionType.${selectedEvent.type}`)}
                          </span>
                        </div>

                        {/* The link this event hangs off, and the control to
                            change it. Shown even when there's no parent, so an
                            unconnected event has a visible way to be attached
                            rather than silently floating. */}
                        {isRelinking ? (
                          <div className="mt-1.5 flex flex-col gap-1.5 rounded-md border border-border bg-muted/50 p-1.5">
                            <span className="text-[10px] font-medium text-muted-foreground">{t("cluster.expand.relinkTitle")}</span>
                            <BranchParentPicker
                              value={selectedEvent.parentInteractionId}
                              onChange={handleRelink}
                              excludeId={selectedEvent.id}
                              className="w-full"
                            />
                            <button
                              onClick={() => setIsRelinking(false)}
                              className="self-start text-[10px] text-muted-foreground hover:text-foreground"
                            >
                              {t("cluster.expand.cancel")}
                            </button>
                          </div>
                        ) : (
                          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <GitBranch className="size-2.5 shrink-0" />
                            {parentEvent ? (
                              <button onClick={() => selectEvent(parentEvent.id)} className="min-w-0 truncate text-left hover:text-foreground">
                                {t("cluster.branchedFrom")} {entityLabel(parentEvent.entity)} — {truncate(parentEvent.rawText, 34)}
                              </button>
                            ) : (
                              <span className="truncate">{t("cluster.expand.noParent")}</span>
                            )}
                          </div>
                        )}

                        {isEditingText ? (
                          <div className="mt-1.5 flex flex-col gap-1.5">
                            <div className="flex gap-2">
                              <Select value={editType} onValueChange={(v) => setEditType(v || "")}>
                                <SelectTrigger className="h-7 w-[120px] text-xs">
                                  <SelectValue placeholder="Type" />
                                </SelectTrigger>
                                <SelectContent>
                                  {(Object.keys(INTERACTION_TYPE_LABELS) as Array<keyof typeof INTERACTION_TYPE_LABELS>).map((type) => (
                                    <SelectItem key={type} value={type} className="text-xs">
                                      {INTERACTION_TYPE_LABELS[type]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <input
                                type="date"
                                value={editDate}
                                onChange={(e) => setEditDate(e.target.value)}
                                className="h-7 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                              />
                            </div>
                            <Textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              className="min-h-16 resize-none border-border bg-muted text-base md:text-xs"
                              autoFocus
                            />
                            <div className="flex gap-1.5">
                              <Button size="sm" onClick={handleSaveText} disabled={isPending || !editText.trim()} className="h-6.5 text-[11px]">
                                {isPending && <Loader2 className="size-3 animate-spin" />}
                                {t("cluster.expand.save")}
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setIsEditingText(false)} className="h-6.5 text-[11px]">
                                {t("cluster.expand.cancel")}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-1.5 whitespace-pre-wrap text-foreground/90">{selectedEvent.rawText}</p>
                        )}

                        {selectedEventChildren.length > 0 && !isEditingText && (
                          <p className="mt-1.5 text-[10.5px] text-muted-foreground">
                            {selectedEventChildren.length} {t("cluster.branchesLabel")}
                          </p>
                        )}

                        {isAddingBranch && (
                          <div className="mt-2 flex flex-col gap-1.5 border-t border-border pt-2">
                            <Textarea
                              value={branchDraft}
                              onChange={(e) => setBranchDraft(e.target.value)}
                              placeholder={t("cluster.expand.branchPlaceholder")}
                              className="min-h-14 resize-none border-border bg-muted text-base md:text-xs"
                              autoFocus
                            />
                            <div className="flex gap-1.5">
                              <Button size="sm" onClick={handleAddBranch} disabled={isPending || !branchDraft.trim()} className="h-6.5 text-[11px]">
                                {isPending && <Loader2 className="size-3 animate-spin" />}
                                {t("cluster.expand.save")}
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setIsAddingBranch(false)} className="h-6.5 text-[11px]">
                                {t("cluster.expand.cancel")}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => setSelectedEventId(null)}
                        className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={t("cluster.expand.close")}
                      >
                        <X className="size-4" />
                      </button>
                    </div>

                    {/* Named actions, not bare icons — this is the panel where an
                        event actually gets rewritten, re-pointed or grown from,
                        so each control says what it does. */}
                    {!isEditingText && !isAddingBranch && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-border pt-2.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditText(selectedEvent.rawText);
                            setEditType(selectedEvent.type);
                            setEditDate(format(new Date(selectedEvent.createdAt), "yyyy-MM-dd"));
                            setIsEditingText(true);
                          }}
                          className="h-8 gap-1.5 px-2.5 text-[11px]"
                        >
                          <Pencil className="size-3.5" />
                          {t("cluster.expand.edit")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setIsAddingBranch(true)}
                          className="h-8 gap-1.5 px-2.5 text-[11px]"
                        >
                          <Plus className="size-3.5" />
                          {t("cluster.expand.addBranch")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setIsRelinking(true)}
                          className="h-8 gap-1.5 px-2.5 text-[11px]"
                        >
                          <GitBranch className="size-3.5" />
                          {parentEvent ? t("cluster.expand.relink") : t("cluster.expand.link")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setIsDeleteOpen(true)}
                          className="ml-auto h-8 gap-1.5 px-2.5 text-[11px] text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                          {t("cluster.expand.delete")}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </DialogContent>

      <ConfirmDeleteDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        description={t("cluster.expand.deleteConfirm")}
        onConfirm={handleDelete}
      />
    </Dialog>
  );
}
