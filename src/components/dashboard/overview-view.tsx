"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { uk, enUS } from "date-fns/locale";
import { ArrowUpRight, GitBranch } from "lucide-react";

import { NetworkGraphPreview } from "@/components/graph/network-graph-preview";
import { StatCard } from "@/components/dashboard/stat-card";
import { Sparkline } from "@/components/dashboard/sparkline";
import { ClusterWorkflowDiagram } from "@/components/timeline/cluster-workflow-diagram";
import { entityKey, entityLabel } from "@/lib/timeline-entity";
import { CATEGORY_COLORS } from "@/lib/contact-display";
import { useTranslation } from "@/lib/i18n/context";
import type { ContactCategory } from "@/generated/prisma/enums";
import type { NetworkStats } from "@/lib/data/graph";
import type { DashboardSummary } from "@/lib/dashboard-summary";

interface OverviewViewProps {
  summary: DashboardSummary;
  topHubs: NetworkStats["topHubs"];
}

export function OverviewView({ summary, topHubs }: OverviewViewProps) {
  const { t, locale } = useTranslation();
  const dateLocale = locale === "uk" ? uk : enUS;
  const [workflow, setWorkflow] = useState<{ entityKey: string; eventId: string } | null>(null);

  const categoryBreakdown = (Object.entries(summary.categoryCounts) as [ContactCategory, number][]).filter(
    ([, count]) => count > 0,
  );
  const categoryTotal = categoryBreakdown.reduce((sum, [, count]) => sum + count, 0);
  const maxRelationshipCount = Math.max(1, ...summary.mostActiveRelationships.map((r) => r.count));

  return (
    <div className="flex flex-col gap-5 pb-12">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div>
          <p className="kicker" style={{ fontSize: "11px", color: "#a6a6a0" }}>
            {format(new Date(summary.today), "EEEE, d MMMM yyyy", { locale: dateLocale })}
          </p>
          <h1 className="mt-[7px] font-heading text-[27px] font-semibold tracking-[-0.6px] text-foreground">
            {t("dashboard.overviewHeading")}
          </h1>
        </div>
        <div className="flex gap-[9px]">
          <Link
            href="/contacts"
            className="whitespace-nowrap rounded-[10px] bg-[#1b1d21] px-[15px] py-[9px] text-[12.5px] font-semibold text-white transition-colors hover:bg-[#33363d]"
          >
            {t("dashboard.newEntity")}
          </Link>
          <Link
            href="/network"
            className="whitespace-nowrap rounded-[10px] border border-[#e4e3de] bg-card px-[15px] py-[9px] text-[12.5px] font-semibold text-foreground transition-colors hover:border-[#c9c8c2]"
          >
            {t("dashboard.openGraph")}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-[14px] sm:grid-cols-4">
        <StatCard
          label={t("dashboard.stat.entities")}
          value={summary.entitiesTracked}
          unit={t("dashboard.stat.entitiesUnit")}
        >
          {categoryTotal > 0 && (
            <div className="flex h-[6px] w-full gap-[4px] overflow-hidden rounded-[3px]">
              {categoryBreakdown.map(([category, count]) => (
                <div
                  key={category}
                  className="rounded-[2px]"
                  style={{ width: `${(count / categoryTotal) * 100}%`, backgroundColor: CATEGORY_COLORS[category].dot }}
                  title={`${category}: ${count}`}
                />
              ))}
            </div>
          )}
        </StatCard>

        <StatCard
          label={t("dashboard.stat.relationships")}
          value={summary.relationshipsCount}
          unit={t("dashboard.stat.relationshipsUnit")}
        />

        <StatCard
          label={t("dashboard.stat.interactions")}
          value={summary.interactionsCount}
          unit={t("dashboard.stat.interactionsUnit")}
        >
          <Sparkline values={summary.interactionsByDay} className="h-6 w-full text-accent" />
        </StatCard>

        <StatCard
          label={t("dashboard.stat.needsAttention")}
          value={summary.needsAttention.length}
          delta={t("dashboard.stat.staleDelta")}
          deltaClassName="text-[#ef8163]"
        >
          {summary.needsAttention.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              {summary.needsAttention.slice(0, 3).map((c) => (
                <Link
                  key={c.id}
                  href={`/contacts/${c.id}`}
                  className="truncate text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                >
                  {c.name}
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">{t("dashboard.needsAttention.empty")}</p>
          )}
        </StatCard>
      </div>

      <div className="grid gap-3.5 md:grid-cols-5 items-start">
        <div className="md:col-span-3">
          <NetworkGraphPreview topHubs={topHubs} />
        </div>

        <div className="flex flex-col gap-3.5 md:col-span-2">
          <div className="rounded-[16px] border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-[18px] pt-[15px] pb-[11px]">
              <h2 className="text-[14px] font-semibold text-foreground">{t("dashboard.feed.latestInteractions")}</h2>
              <Link
                href="/timeline"
                className="flex items-center gap-0.5 text-[11.5px] font-semibold text-accent hover:underline"
              >
                {t("dashboard.feed.viewAll")}
                <ArrowUpRight className="size-3" />
              </Link>
            </div>
            {summary.latestInteractions.length === 0 ? (
              <p className="px-[18px] py-6 text-center text-xs text-muted-foreground">{t("dashboard.feed.empty")}</p>
            ) : (
              <div className="flex flex-col">
                {summary.latestInteractions.map((event) => {
                  const entity = event.entity;
                  const href =
                    entity.kind === "contact"
                      ? `/contacts/${entity.contact.id}`
                      : entity.kind === "connection"
                        ? `/contacts/${entity.fromContact.id}`
                        : entity.kind === "company"
                          ? "/companies"
                          : "/communities";
                  const label = entityLabel(entity);
                  const dotColor =
                    entity.kind === "contact"
                      ? CATEGORY_COLORS[entity.contact.category as ContactCategory].dot
                      : CATEGORY_COLORS.OTHER.dot;
                  // The workflow diagram is a Contact/ContactConnection BFS —
                  // a company/community event has no cluster to open there.
                  const canOpenHistory = entity.kind === "contact" || entity.kind === "connection";

                  return (
                    <div
                      key={event.id}
                      className="flex items-start gap-[11px] border-t border-border px-[18px] py-[11px] first:border-t-0 hover:bg-muted"
                    >
                      <span
                        className="mt-[5px] size-[7px] shrink-0 rounded-full"
                        style={{ backgroundColor: dotColor }}
                      />
                      <Link href={href} className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-medium leading-[1.35] text-foreground">
                          {event.rawText}
                        </p>
                        <div className="mt-1 flex items-center gap-[7px] font-mono text-[10px] text-muted-foreground">
                          <span>{format(new Date(event.createdAt), "d MMM", { locale: dateLocale })}</span>
                          <span>·</span>
                          <span className="truncate">{label}</span>
                        </div>
                      </Link>
                      <span className="h-[18px] shrink-0 rounded-[20px] bg-muted px-[7px] text-[10px] font-semibold leading-[18px] text-muted-foreground">
                        {t(`interactionType.${event.type}`)}
                      </span>
                      {/* This note lives in the same interaction graph as
                          Follow-ups/Timeline already link into — without
                          this, the widget's only exit was the contact
                          profile, with no way back to this specific note's
                          place in its history. */}
                      {canOpenHistory && (
                        <button
                          onClick={() => setWorkflow({ entityKey: entityKey(event.entity), eventId: event.id })}
                          title={t("timelineView.openCluster")}
                          className="shrink-0 rounded-md p-1 text-muted-foreground/50 transition-colors hover:bg-card hover:text-foreground"
                        >
                          <GitBranch className="size-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-[16px] border border-border bg-card px-[18px] py-[15px]">
            <h2 className="mb-3 text-[14px] font-semibold text-foreground">{t("dashboard.feed.mostActive")}</h2>
            {summary.mostActiveRelationships.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">{t("dashboard.feed.empty")}</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {summary.mostActiveRelationships.map((rel) => (
                  <div key={rel.key}>
                    <div className="flex items-center gap-1.5 text-[12.5px] font-medium">
                      <span className="truncate text-foreground/90">{rel.label}</span>
                      <span className="ml-auto shrink-0 font-mono text-[10.5px] text-muted-foreground">
                        {rel.count}
                      </span>
                    </div>
                    <div className="mt-1 h-[5px] w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${(rel.count / maxRelationshipCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <ClusterWorkflowDiagram
        open={workflow != null}
        onOpenChange={(open) => !open && setWorkflow(null)}
        entityKey={workflow?.entityKey ?? null}
        initialEventId={workflow?.eventId ?? null}
      />
    </div>
  );
}
