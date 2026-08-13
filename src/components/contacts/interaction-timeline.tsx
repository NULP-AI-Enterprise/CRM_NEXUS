"use client";

import { CalendarClock } from "lucide-react";
import { uk, enUS } from "date-fns/locale";
import { formatDistanceToNow } from "date-fns";

import { useTranslation } from "@/lib/i18n/context";
import type { InteractionModel } from "@/generated/prisma/models";

export function InteractionTimeline({ interactions }: { interactions: InteractionModel[] }) {
  const { t, locale } = useTranslation();
  const dateLocale = locale === "uk" ? uk : enUS;

  if (interactions.length === 0) {
    return <p className="text-xs text-zinc-500">{t("timeline.empty")}</p>;
  }

  // The most recent note is the only place a still-relevant follow-up could
  // live — anything extracted from older notes is presumed stale/resolved.
  const upcoming = interactions[0]?.followUp;

  return (
    <div className="flex flex-col gap-3">
      {upcoming && (
        <div className="relative ml-[1px] flex items-start gap-2.5 rounded-lg border border-dashed border-amber-500/30 bg-amber-500/[0.06] p-3">
          <CalendarClock className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
              {t("timeline.upcoming")}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-amber-100/90">{upcoming}</p>
          </div>
        </div>
      )}

      <ol>
        {interactions.map((interaction, index) => {
          const isLast = index === interactions.length - 1;
          return (
            <li key={interaction.id} className={`relative ${isLast ? "" : "pb-4"}`}>
              <div className="flex gap-3">
                <div className="relative flex w-3 shrink-0 flex-col items-center">
                  <span
                    className={`z-10 mt-1 size-2.5 rounded-full border-2 ${
                      index === 0 ? "border-white bg-white" : "border-zinc-600 bg-zinc-950"
                    }`}
                  />
                </div>
                <div className="min-w-0 flex-1 rounded-lg border border-white/[0.06] bg-zinc-900/40 p-2.5">
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <span className="rounded bg-zinc-800 px-1.5 py-0.2 text-[10px] font-medium text-zinc-300">
                      {t(`interactionType.${interaction.type}`)}
                    </span>
                    <span className="font-mono text-[11px] text-zinc-500">
                      {formatDistanceToNow(interaction.createdAt, { addSuffix: true, locale: dateLocale })}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-zinc-200">
                    {interaction.rawText}
                  </p>
                </div>
              </div>
              {!isLast && <span className="absolute bottom-0 left-1.5 top-4 w-px bg-zinc-800" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
