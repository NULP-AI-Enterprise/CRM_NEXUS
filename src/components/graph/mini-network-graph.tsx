"use client";

import { useMemo, useState } from "react";
import { Share2 } from "lucide-react";

import { CATEGORY_COLORS, initials } from "@/lib/contact-display";
import type { ContactCategory } from "@/generated/prisma/enums";

export interface MiniGraphNode {
  id: string;
  name: string;
  category: ContactCategory | "COMPANY";
  isCenter?: boolean;
}

export interface MiniGraphEdge {
  aId: string;
  bId: string;
  relationship?: string | null;
}

interface Point {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const W = 480;
const H = 260;
const COMPANY_DOT = "#1F6349";

/** A one-shot force layout, not a live simulation: positions are settled here
 * and rendered statically. The old version ran a `requestAnimationFrame`
 * loop forever with randomized initial velocities, so it visibly jittered
 * without ever converging — a graph of 5-15 nodes doesn't need continuous
 * physics, it needs to settle once and hold still. No `Math.random()` either,
 * so the same input always lays out the same way. */
function layoutNodes(nodes: MiniGraphNode[], edges: MiniGraphEdge[]): Map<string, Point> {
  const pos = new Map<string, Point>();
  const center = nodes.find((n) => n.isCenter);
  const others = center ? nodes.filter((n) => !n.isCenter) : nodes;

  others.forEach((n, i) => {
    const angle = (i / Math.max(1, others.length)) * Math.PI * 2;
    const radius = center ? 90 : Math.min(100, 40 + others.length * 6);
    pos.set(n.id, {
      x: W / 2 + Math.cos(angle) * radius,
      y: H / 2 + Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
    });
  });
  if (center) pos.set(center.id, { x: W / 2, y: H / 2, vx: 0, vy: 0 });

  const EDGE_LEN = 95;
  const MIN_SEP = 54;
  for (let iter = 0; iter < 150; iter++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = pos.get(nodes[i]!.id)!;
        const b = pos.get(nodes[j]!.id)!;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < MIN_SEP) {
          const f = ((MIN_SEP - dist) / dist) * 0.06;
          a.vx += dx * f;
          a.vy += dy * f;
          b.vx -= dx * f;
          b.vy -= dy * f;
        }
      }
    }
    for (const e of edges) {
      const a = pos.get(e.aId);
      const b = pos.get(e.bId);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      const f = ((dist - EDGE_LEN) / dist) * 0.02;
      a.vx += dx * f;
      a.vy += dy * f;
      b.vx -= dx * f;
      b.vy -= dy * f;
    }
    for (const n of nodes) {
      const p = pos.get(n.id)!;
      if (n.isCenter) {
        p.x = W / 2;
        p.y = H / 2;
        continue;
      }
      p.vx += (W / 2 - p.x) * 0.0015;
      p.vy += (H / 2 - p.y) * 0.0015;
      p.vx *= 0.82;
      p.vy *= 0.82;
      p.x = Math.min(W - 30, Math.max(30, p.x + p.vx));
      p.y = Math.min(H - 34, Math.max(34, p.y + p.vy));
    }
  }
  return pos;
}

function dotColorFor(category: ContactCategory | "COMPANY"): string {
  return category === "COMPANY" ? COMPANY_DOT : CATEGORY_COLORS[category]?.dot ?? CATEGORY_COLORS.OTHER.dot;
}

interface MiniRelationshipGraphProps {
  title: string;
  countLabel?: string;
  nodes: MiniGraphNode[];
  edges: MiniGraphEdge[];
  onNodeClick?: (id: string) => void;
  addButton?: { label: string; onClick: () => void };
  emptyLabel: string;
  emptyAction?: { label: string; onClick: () => void };
}

export function MiniRelationshipGraph({
  title,
  countLabel,
  nodes,
  edges,
  onNodeClick,
  addButton,
  emptyLabel,
  emptyAction,
}: MiniRelationshipGraphProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const positions = useMemo(() => layoutNodes(nodes, edges), [nodes, edges]);
  const peerCount = nodes.filter((n) => !n.isCenter).length;

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-4 transition-colors">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Share2 className="size-3.5 text-muted-foreground" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">{title}</h3>
          <span className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {countLabel ?? peerCount}
          </span>
        </div>
        {addButton && (
          <button
            onClick={addButton.onClick}
            className="flex h-6.5 items-center gap-1 rounded-md bg-secondary px-2.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/70"
          >
            {addButton.label}
          </button>
        )}
      </div>

      {peerCount === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2.5 py-8 text-center text-xs text-muted-foreground">
          <p>{emptyLabel}</p>
          {emptyAction && (
            <button
              onClick={emptyAction.onClick}
              className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              {emptyAction.label}
            </button>
          )}
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-[260px] w-full rounded-lg border border-border bg-muted">
          {nodes.map((n) => {
            if (n.isCenter) return null;
            const from = positions.get(n.id);
            const relatedEdges = edges.filter((e) => e.aId === n.id || e.bId === n.id);
            return relatedEdges.map((e) => {
              const otherId = e.aId === n.id ? e.bId : e.aId;
              const other = positions.get(otherId);
              if (!from || !other) return null;
              const midX = (from.x + other.x) / 2;
              const midY = (from.y + other.y) / 2;
              return (
                <g key={`${e.aId}-${e.bId}`}>
                  <line x1={from.x} y1={from.y} x2={other.x} y2={other.y} stroke="var(--border)" strokeWidth={1.2} />
                  {e.relationship && (
                    <text
                      x={midX}
                      y={midY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={9}
                      fill="var(--muted-foreground)"
                      style={{ paintOrder: "stroke", stroke: "var(--muted)", strokeWidth: 3 }}
                    >
                      {e.relationship}
                    </text>
                  )}
                </g>
              );
            });
          })}

          {nodes.map((n) => {
            const p = positions.get(n.id);
            if (!p) return null;
            const isHovered = hoveredId === n.id;
            const r = n.isCenter ? 22 : 17;
            return (
              <g
                key={n.id}
                transform={`translate(${p.x}, ${p.y})`}
                className={n.isCenter ? "" : "cursor-pointer"}
                onMouseEnter={() => setHoveredId(n.id)}
                onMouseLeave={() => setHoveredId((id) => (id === n.id ? null : id))}
                onClick={() => !n.isCenter && onNodeClick?.(n.id)}
              >
                <title>{n.name}</title>
                <circle
                  r={r}
                  fill={n.isCenter ? "var(--foreground)" : isHovered ? "var(--secondary)" : "var(--card)"}
                  stroke={n.isCenter ? "var(--primary)" : isHovered ? "var(--muted-foreground)" : "var(--border)"}
                  strokeWidth={n.isCenter ? 2 : 1.2}
                />
                {!n.isCenter && (
                  <circle cx={r * 0.68} cy={-r * 0.68} r={3.2} fill={dotColorFor(n.category)} stroke="var(--card)" strokeWidth={1} />
                )}
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={n.isCenter ? 11 : 9.5}
                  fontWeight={500}
                  fill={n.isCenter ? "var(--card)" : "var(--foreground)"}
                >
                  {initials(n.name)}
                </text>
                <text
                  y={r + 13}
                  textAnchor="middle"
                  fontSize={10}
                  fill={n.isCenter ? "var(--foreground)" : "var(--muted-foreground)"}
                >
                  {n.name.length > 15 ? `${n.name.slice(0, 13)}…` : n.name}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
