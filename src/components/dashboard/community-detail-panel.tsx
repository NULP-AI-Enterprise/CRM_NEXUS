"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UsersRound } from "lucide-react";
import { format } from "date-fns";
import { uk, enUS } from "date-fns/locale";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MiniRelationshipGraph, type MiniGraphEdge, type MiniGraphNode } from "@/components/graph/mini-network-graph";
import { CATEGORY_COLORS, initials } from "@/lib/contact-display";
import { useTranslation } from "@/lib/i18n/context";
import type { CommunityGraphData } from "@/lib/data/communities";

export function CommunityDetailPanel({
  communityId,
  onOpenChange,
}: {
  communityId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const dateLocale = locale === "uk" ? uk : enUS;
  const [data, setData] = useState<CommunityGraphData | null>(null);
  const [error, setError] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  useEffect(() => {
    if (!communityId) return;
    let cancelled = false;
    fetch(`/api/communities/${communityId}/graph`)
      .then((res) => (res.ok ? (res.json() as Promise<CommunityGraphData>) : Promise.reject()))
      .then((json) => {
        if (cancelled) return;
        setData(json);
        setError(false);
        setLoadedId(communityId);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoadedId(communityId);
      });
    return () => {
      cancelled = true;
    };
  }, [communityId]);

  const isLoading = Boolean(communityId) && loadedId !== communityId;

  const nodes: MiniGraphNode[] = data?.members.map((m) => ({ id: m.id, name: m.fullName, category: m.category })) ?? [];
  const edges: MiniGraphEdge[] = data?.edges.map((e) => ({ aId: e.aId, bId: e.bId, relationship: e.relationship })) ?? [];

  return (
    <Dialog
      open={Boolean(communityId)}
      onOpenChange={(open) => {
        if (!open) {
          onOpenChange(false);
          setData(null);
          setLoadedId(null);
          setError(false);
        }
      }}
    >
      <DialogContent className="max-h-[85vh] w-[92vw] max-w-2xl overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
          </div>
        )}

        {!isLoading && error && (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
            <p>{t("community.detail.loadError")}</p>
          </div>
        )}

        {!isLoading && !error && data && (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg" style={{ backgroundColor: "#F1EBFC" }}>
                  <UsersRound className="size-4" style={{ color: "#4E3487" }} />
                </div>
                {data.name}
              </DialogTitle>
              {data.description && <p className="mt-1 text-xs text-muted-foreground">{data.description}</p>}
            </DialogHeader>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[
                { label: t("community.detail.members"), value: data.members.length },
                { label: t("community.detail.connections"), value: data.edges.length },
                { label: t("community.detail.interactions"), value: data.totalInteractions },
                {
                  label: t("community.detail.mostActive"),
                  value: data.members.find((m) => m.id === data.mostActiveMemberId)?.fullName ?? "—",
                  small: true,
                },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg border border-border bg-muted px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{stat.label}</div>
                  <div className={stat.small ? "mt-0.5 truncate text-sm font-semibold text-foreground" : "mt-0.5 text-lg font-semibold text-foreground"}>
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>

            <MiniRelationshipGraph
              title={t("community.detail.graphTitle")}
              countLabel={String(data.edges.length)}
              nodes={nodes}
              edges={edges}
              onNodeClick={(id) => router.push(`/contacts/${id}`)}
              emptyLabel={t("community.detail.graphEmpty")}
            />

            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground">{t("community.detail.memberList")}</div>
              <div className="flex flex-col gap-1.5">
                {data.members.map((m) => {
                  const colors = CATEGORY_COLORS[m.category] ?? CATEGORY_COLORS.OTHER;
                  return (
                    <button
                      key={m.id}
                      onClick={() => router.push(`/contacts/${m.id}`)}
                      className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2 text-left hover:bg-muted"
                    >
                      <div
                        className="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-medium"
                        style={{ backgroundColor: colors.bg, color: colors.text }}
                      >
                        {initials(m.fullName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium text-foreground">{m.fullName}</div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {m.interactionCount > 0
                            ? `${m.interactionCount} · ${t("community.detail.lastActive")} ${format(new Date(m.lastInteractionAt!), "d MMM", { locale: dateLocale })}`
                            : t("community.detail.noInteractions")}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
