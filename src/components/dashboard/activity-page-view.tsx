"use client";

import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { format } from "date-fns";
import { uk, enUS } from "date-fns/locale";

import { useTranslation } from "@/lib/i18n/context";
import { entityLabel, type TimelineEvent } from "@/lib/timeline-entity";

export function ActivityPageView({ followUps }: { followUps: TimelineEvent[] }) {
  const { t, locale } = useTranslation();
  const dateLocale = locale === "uk" ? uk : enUS;

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
                : `/contacts/${event.entity.fromContact.id}`;

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
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
