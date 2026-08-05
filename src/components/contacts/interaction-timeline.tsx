"use client";

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

  return (
    <ol className="flex flex-col gap-3">
      {interactions.map((interaction) => (
        <li key={interaction.id} className="flex flex-col gap-1 border-l border-zinc-800 pl-3.5">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="rounded bg-zinc-800 px-1.5 py-0.2 text-[10px] text-zinc-300 font-medium">
              {t(`interactionType.${interaction.type}`)}
            </span>
            <span className="text-[11px] text-zinc-500 font-mono">
              {formatDistanceToNow(interaction.createdAt, { addSuffix: true, locale: dateLocale })}
            </span>
          </div>
          <p className="text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed">{interaction.rawText}</p>
        </li>
      ))}
    </ol>
  );
}
