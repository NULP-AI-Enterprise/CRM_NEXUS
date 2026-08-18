"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, GitBranch } from "lucide-react";

import { useTranslation } from "@/lib/i18n/context";
import { entityLabel, type TimelineEvent } from "@/lib/timeline-entity";

interface PickerEvent {
  id: string;
  rawText: string;
  entityLabel: string;
}

// Module-level cache for the page session — the picker is an occasional,
// deliberate action (not a primary workflow), so a lazily-fetched, session-
// lived list is a reasonable tradeoff against re-fetching on every open.
let cachedEvents: PickerEvent[] | null = null;
let cachedPromise: Promise<PickerEvent[]> | null = null;

/** Drop the cached list so the next open re-fetches — call after logging a new
 * interaction, otherwise a branch you just created is missing from the picker
 * until a full reload. */
export function invalidateBranchParentCache(): void {
  cachedEvents = null;
  cachedPromise = null;
}

function loadEvents(): Promise<PickerEvent[]> {
  if (cachedEvents) return Promise.resolve(cachedEvents);
  if (!cachedPromise) {
    cachedPromise = fetch("/api/timeline")
      .then((res) => (res.ok ? res.json() : { events: [] }))
      .then((data: { events: TimelineEvent[] }) => data.events.map((e) => ({ id: e.id, rawText: e.rawText, entityLabel: entityLabel(e.entity) })))
      .then((events) => {
        cachedEvents = events;
        return events;
      })
      .catch(() => []);
  }
  return cachedPromise;
}

/** "Attach to" control shown wherever an interaction gets logged — main line
 * (null) or branch off any of the user's own past events, searchable across
 * the whole account. Account-wide (not scoped to the current entity) is what
 * makes a cross-entity provenance chain pickable at all: e.g. X introduced Y,
 * so Y's very first interaction needs to be able to branch off X's event,
 * before anything else links X and Y together. */
export function BranchParentPicker({
  value,
  onChange,
  className,
  excludeId,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  className?: string;
  /** Hide one event from the list — used when re-pointing an existing event,
   * which can never branch off itself. Deeper loops (picking a descendant)
   * can't be detected from this list alone and are rejected server-side. */
  excludeId?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [events, setEvents] = useState<PickerEvent[] | null>(cachedEvents);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || events) return;
    loadEvents().then(setEvents);
  }, [open, events]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const selected = events?.find((e) => e.id === value) ?? null;
  const q = query.trim().toLowerCase();
  const filtered = (events ?? [])
    .filter((e) => e.id !== excludeId)
    .filter((e) => !q || e.rawText.toLowerCase().includes(q) || e.entityLabel.toLowerCase().includes(q))
    .slice(0, 30);

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={t("branch.pickerLabel")}
        className="flex h-7 w-full items-center gap-1.5 rounded-md border border-border bg-muted px-1.5 text-[11px] text-foreground"
      >
        <GitBranch className="size-3 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-left">
          {selected ? `${selected.entityLabel} — ${selected.rawText}` : t("branch.mainLine")}
        </span>
        <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-72 max-w-[90vw] rounded-md border border-border bg-card shadow-md">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("branch.searchPlaceholder")}
            className="w-full border-b border-border bg-transparent px-2 py-1.5 text-xs outline-none"
          />
          <div className="max-h-56 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className={`block w-full px-2 py-1.5 text-left text-[11px] hover:bg-muted ${value === null ? "font-semibold text-foreground" : "text-muted-foreground"}`}
            >
              {t("branch.mainLine")}
            </button>
            {events === null ? (
              <p className="px-2 py-1.5 text-[11px] text-muted-foreground">{t("branch.loading")}</p>
            ) : filtered.length === 0 ? (
              <p className="px-2 py-1.5 text-[11px] text-muted-foreground">{t("filters.empty")}</p>
            ) : (
              filtered.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => {
                    onChange(ev.id);
                    setOpen(false);
                  }}
                  className={`block w-full px-2 py-1.5 text-left text-[11px] hover:bg-muted ${value === ev.id ? "bg-muted font-semibold" : ""}`}
                >
                  <span className="font-medium">{ev.entityLabel}</span>
                  <span className="text-muted-foreground"> — {ev.rawText.length > 50 ? `${ev.rawText.slice(0, 50)}…` : ev.rawText}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
