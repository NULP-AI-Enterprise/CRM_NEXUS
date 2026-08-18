"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { CATEGORY_COLORS } from "@/lib/contact-display";
import { useTranslation } from "@/lib/i18n/context";
import type { ContactCategory } from "@/generated/prisma/enums";
import type { NetworkStats } from "@/lib/data/graph";

interface NetworkGraphPreviewProps {
  topHubs: NetworkStats["topHubs"];
}

const CENTER = 50;
const RADIUS = 34;

export function NetworkGraphPreview({ topHubs }: NetworkGraphPreviewProps) {
  const { t } = useTranslation();

  const hubPositions = topHubs.map((hub, i) => {
    const angle = (i / Math.max(topHubs.length, 1)) * Math.PI * 2 - Math.PI / 2;
    return {
      hub,
      x: CENTER + RADIUS * Math.cos(angle),
      y: CENTER + RADIUS * Math.sin(angle),
    };
  });

  const presentCategories = Array.from(new Set(topHubs.map((h) => h.category))) as ContactCategory[];

  return (
    <div className="rounded-[16px] border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-[18px] pt-[15px] pb-3 border-b border-border">
        <div>
          <h2 className="text-[14px] font-semibold text-foreground">{t("dashboard.networkPreview.title")}</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{t("dashboard.networkPreview.subtitle")}</p>
        </div>
        <Link
          href="/network"
          className="flex items-center gap-0.5 text-[11.5px] font-semibold text-accent hover:underline"
        >
          {t("dashboard.networkPreview.viewFull")}
          <ArrowUpRight className="size-3" />
        </Link>
      </div>

      {hubPositions.length === 0 ? (
        <p className="py-16 text-center text-xs text-muted-foreground">{t("dashboard.networkPreview.empty")}</p>
      ) : (
        <div className="relative h-[290px] bg-muted/40">
          <svg viewBox="0 0 100 100" className="size-full" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {hubPositions.map(({ hub, x, y }) => (
              <line key={`line-${hub.id}`} x1={CENTER} y1={CENTER} x2={x} y2={y} stroke="var(--border)" strokeWidth="0.6" />
            ))}

            <circle cx={CENTER} cy={CENTER} r="5" className="fill-primary" />
            <text x={CENTER} y={CENTER + 9.5} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: "4.5px" }}>
              {t("dashboard.networkPreview.you")}
            </text>

            {hubPositions.map(({ hub, x, y }) => (
              <g key={hub.id}>
                <circle cx={x} cy={y} r={3 + Math.min(hub.degree, 6) * 0.4} fill={CATEGORY_COLORS[hub.category].dot} />
                <text
                  x={x}
                  y={y + 7}
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  style={{ fontSize: "4px" }}
                >
                  {hub.name.length > 12 ? `${hub.name.slice(0, 11)}…` : hub.name}
                </text>
              </g>
            ))}
          </svg>

          {presentCategories.length > 0 && (
            <div className="absolute bottom-3 left-3.5 flex gap-3 rounded-[9px] border border-border bg-card/85 px-2.5 py-1.5 backdrop-blur-sm">
              {presentCategories.map((cat) => (
                <div key={cat} className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                  <span className="size-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[cat].dot }} />
                  {t(`category.${cat}`)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
