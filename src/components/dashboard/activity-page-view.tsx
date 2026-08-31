"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, GitBranch } from "lucide-react";
import { format } from "date-fns";
import { uk, enUS } from "date-fns/locale";

import { useTranslation } from "@/lib/i18n/context";
import { entityKey, entityLabel, type TimelineEvent } from "@/lib/timeline-entity";
import { ClusterWorkflowDiagram } from "@/components/timeline/cluster-workflow-diagram";

export function ActivityPageView({ followUps }: { followUps: TimelineEvent[] }) {
  const { t, locale } = useTranslation();
  const dateLocale = locale === "uk" ? uk : enUS;
  const [workflow, setWorkflow] = useState<{ entityKey: string; eventId: string } | null>(null);

  return (
    <div className="flex flex-col gap-4 pb-12">
      <h1 className="font-heading text-lg font-semibold text-foreground">
        {t("activity.title")} <span className="text-sm font-normal text-muted-foreground">({followUps.length})</span>
      </h1>

      {followUps.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("activity.empty")}</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {followUps.map((event) => {
            const href =
              event.entity.kind === "contact"
                ? `/contacts/${event.entity.contact.id}`
                : event.entity.kind === "connection"
                  ? `/contacts/${event.entity.fromContact.id}`
                  : event.entity.kind === "company"
                    ? "/companies"
                    : "/communities";
            // The workflow diagram is a Contact/ContactConnection BFS — a
            // company/community event has no cluster to open there.
            const canOpenHistory = event.entity.kind === "contact" || event.entity.kind === "connection";

            return (
              <div
                key={event.id}
                className="flex items-start gap-2.5 rounded-xl border border-dashed border-amber-400/50 bg-amber-400/10 px-3.5 py-3"
              >
                <CalendarClock className="mt-0.5 size-3.5 shrink-0 text-amber-700" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={href} className="text-xs font-semibold text-foreground hover:underline truncate">
                      {entityLabel(event.entity)}
                    </Link>
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                      {format(new Date(event.followUpDate!), "d MMM", { locale: dateLocale })}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-amber-900/90">{event.followUp}</p>

                  {/* The action alone ("find out about X") reads as a bare
                      instruction with no memory of why it matters — the note
                      it came from is already fetched, just wasn't shown. */}
                  <p className="mt-1.5 text-[11px] leading-relaxed text-amber-800/70">
                    <span className="font-medium">{t("activity.fromNote")}</span> {event.rawText}
                  </p>

                  {canOpenHistory && (
                    <button
                      onClick={() => setWorkflow({ entityKey: entityKey(event.entity), eventId: event.id })}
                      className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-amber-800 hover:underline"
                    >
                      <GitBranch className="size-3" />
                      {t("activity.openInHistory")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ClusterWorkflowDiagram
        open={workflow != null}
        onOpenChange={(open) => !open && setWorkflow(null)}
        entityKey={workflow?.entityKey ?? null}
        initialEventId={workflow?.eventId ?? null}
      />
    </div>
  );
}
