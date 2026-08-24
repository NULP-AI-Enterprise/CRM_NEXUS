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

// "You" node sits at true center of the 100×100 viewBox
const CX = 50;
const CY = 50;
// Hub nodes spread out to this max radius
const MAX_R = 39;
// Golden angle (≈137.5°) — produces a sunflower/phyllotaxis spiral that looks
// organic: no two nodes line up, spacing is naturally even without being circular
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

// Deterministic per-id hash → [0, 1) used for a small position jitter so nodes
// with similar indices don't look symmetrically mirrored
function idJitter(id: string): number {
  let h = 0;
  for (let k = 0; k < id.length; k++) {
    h = (Math.imul(31, h) + id.charCodeAt(k)) | 0;
  }
  return ((h >>> 0) % 1000) / 1000;
}

export function NetworkGraphPreview({ topHubs }: NetworkGraphPreviewProps) {
  const { t } = useTranslation();

  const n = topHubs.length;

  // Fibonacci spiral positions — r grows as √(i/n) so inner slots aren't
  // crowded and outer ones aren't sparse. Small jitter keeps it from looking
  // like a textbook diagram.
  const hubPositions = topHubs.map((hub, i) => {
    const r = MAX_R * Math.sqrt((i + 1) / n);
    const angle = i * GOLDEN_ANGLE;
    const j = (idJitter(hub.id) - 0.5) * 2.5;
    return {
      hub,
      x: CX + r * Math.cos(angle) + j,
      y: CY + r * Math.sin(angle) + j,
    };
  });

  // Connect each node to its single nearest neighbor (de-duplicated).
  // Even without real edge data this produces a graph that reads as a network
  // rather than a hub-and-spoke wheel.
  const edgeSet = new Set<string>();
  const crossEdges: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  for (let i = 0; i < hubPositions.length; i++) {
    let nearJ = -1;
    let nearDist = Infinity;
    for (let j = 0; j < hubPositions.length; j++) {
      if (j === i) continue;
      const dx = hubPositions[j].x - hubPositions[i].x;
      const dy = hubPositions[j].y - hubPositions[i].y;
      const d = dx * dx + dy * dy;
      if (d < nearDist) { nearDist = d; nearJ = j; }
    }
    if (nearJ < 0) continue;
    const key = `${Math.min(i, nearJ)}-${Math.max(i, nearJ)}`;
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      crossEdges.push({ x1: hubPositions[i].x, y1: hubPositions[i].y, x2: hubPositions[nearJ].x, y2: hubPositions[nearJ].y });
    }
  }

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
        <div
          className="relative h-[290px]"
          style={{
            backgroundColor: "#F9F9F7",
            backgroundImage: "radial-gradient(circle, #DEDAD4 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
        >
          <svg
            viewBox="0 0 100 100"
            className="relative size-full"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            {/* Spoke edges: hub → "you", dashed, very light */}
            {hubPositions.map(({ hub, x, y }) => (
              <line
                key={`spoke-${hub.id}`}
                x1={CX} y1={CY} x2={x} y2={y}
                stroke="#E0DED7"
                strokeWidth="0.45"
                strokeDasharray="1.6 1.4"
              />
            ))}

            {/* Cross-edges: nearest-neighbor pairs, solid, slightly darker */}
            {crossEdges.map((e, i) => (
              <line
                key={`cross-${i}`}
                x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                stroke="#CFCDC5"
                strokeWidth="0.55"
              />
            ))}

            {/* Hub nodes */}
            {hubPositions.map(({ hub, x, y }) => {
              const r = 2.8 + Math.min(hub.degree, 8) * 0.28;
              const color = CATEGORY_COLORS[hub.category as ContactCategory].dot;
              const label = hub.name.length > 11 ? `${hub.name.slice(0, 10)}…` : hub.name;
              return (
                <g key={hub.id}>
                  {/* White halo so node is readable over the dot grid */}
                  <circle cx={x} cy={y} r={r + 1.8} fill="white" opacity="0.85" />
                  <circle cx={x} cy={y} r={r} fill={color} />
                  <text
                    x={x}
                    y={y + r + 4.8}
                    textAnchor="middle"
                    fill="#6E7480"
                    style={{ fontSize: "3.6px", fontFamily: "var(--font-mono)" }}
                  >
                    {label}
                  </text>
                </g>
              );
            })}

            {/* "You" center — dark pill with white dot */}
            <circle cx={CX} cy={CY} r={5.8} fill="#1b1d21" />
            <circle cx={CX} cy={CY} r={1.8} fill="white" opacity="0.9" />
            <text
              x={CX}
              y={CY + 10.2}
              textAnchor="middle"
              fill="#6E7480"
              style={{ fontSize: "3.9px", fontFamily: "var(--font-mono)" }}
            >
              {t("dashboard.networkPreview.you")}
            </text>
          </svg>

          {presentCategories.length > 0 && (
            <div className="absolute bottom-3 left-3.5 flex flex-wrap gap-2.5 rounded-[9px] border border-border bg-card/90 px-2.5 py-1.5 backdrop-blur-sm">
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
