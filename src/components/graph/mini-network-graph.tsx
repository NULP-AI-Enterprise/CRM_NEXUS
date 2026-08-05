"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Share2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CATEGORY_COLORS, initials } from "@/lib/contact-display";
import type { ContactCategory } from "@/generated/prisma/enums";
import { AddConnectionDialog } from "@/components/graph/add-connection-dialog";
import { useTranslation } from "@/lib/i18n/context";

interface MiniContact {
  id: string;
  fullName: string;
  role?: string | null;
  category: ContactCategory;
  relationship?: string | null;
  companyName?: string | null;
}

interface MiniNetworkGraphProps {
  currentContact: {
    id: string;
    fullName: string;
    role?: string | null;
    category: ContactCategory;
    companyName?: string | null;
    usefulnessScore?: number | null;
  };
  connectedContacts: MiniContact[];
  colleagues: MiniContact[];
  otherAvailableContacts: Array<{
    id: string;
    fullName: string;
    role?: string | null;
    companyName?: string | null;
  }>;
}

interface GraphNodeItem {
  id: string;
  name: string;
  role?: string | null;
  category: ContactCategory | "COMPANY";
  isCenter?: boolean;
  relationship?: string | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

export function MiniNetworkGraph({
  currentContact,
  connectedContacts,
  colleagues,
  otherAvailableContacts,
}: MiniNetworkGraphProps) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<GraphNodeItem | null>(null);

  const nodesRef = useRef<GraphNodeItem[]>([]);
  const animRef = useRef<number | null>(null);

  const { t } = useTranslation();

  // Combine unique connected nodes
  const allPeers = React.useMemo(() => {
    const map = new Map<string, MiniContact>();
    for (const c of connectedContacts) {
      map.set(c.id, c);
    }
    for (const col of colleagues) {
      if (!map.has(col.id)) {
        map.set(col.id, { ...col, relationship: t("relationship.colleague") });
      }
    }
    return Array.from(map.values());
  }, [connectedContacts, colleagues, t]);

  useEffect(() => {
    const width = containerRef.current?.clientWidth || 500;
    const height = 300;

    const nodes: GraphNodeItem[] = [
      {
        id: currentContact.id,
        name: currentContact.fullName,
        role: currentContact.role,
        category: currentContact.category,
        isCenter: true,
        x: width / 2,
        y: height / 2,
        vx: 0,
        vy: 0,
        radius: 22,
      },
    ];

    allPeers.forEach((peer, i) => {
      const angle = (i / Math.max(1, allPeers.length)) * Math.PI * 2;
      const dist = 95 + (i % 2 === 0 ? 0 : 25);
      nodes.push({
        id: peer.id,
        name: peer.fullName,
        role: peer.role,
        category: peer.category,
        relationship: peer.relationship,
        x: width / 2 + Math.cos(angle) * dist,
        y: height / 2 + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
        radius: 17,
      });
    });

    nodesRef.current = nodes;
  }, [currentContact, allPeers]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let isRunning = true;

    const render = () => {
      if (!isRunning) return;
      const width = containerRef.current?.clientWidth || 500;
      const height = 300;

      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const nodes = nodesRef.current;
      const center = nodes[0];

      // Physics step
      if (center) {
        center.x = width / 2;
        center.y = height / 2;

        for (let i = 1; i < nodes.length; i++) {
          const node = nodes[i]!;
          const dx = node.x - center.x;
          const dy = node.y - center.y;
          const dist = Math.hypot(dx, dy) || 1;
          const targetDist = 100;
          const spring = (dist - targetDist) * 0.03;

          node.vx -= (dx / dist) * spring;
          node.vy -= (dy / dist) * spring;

          for (let j = 1; j < nodes.length; j++) {
            if (i === j) continue;
            const other = nodes[j]!;
            const odx = node.x - other.x;
            const ody = node.y - other.y;
            const odist = Math.hypot(odx, ody) || 1;
            if (odist < 50) {
              node.vx += (odx / odist) * 0.6;
              node.vy += (ody / odist) * 0.6;
            }
          }

          node.vx *= 0.85;
          node.vy *= 0.85;
          node.x += node.vx;
          node.y += node.vy;
        }
      }

      // Draw minimal monochrome links
      if (center) {
        for (let i = 1; i < nodes.length; i++) {
          const peer = nodes[i]!;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(center.x, center.y);
          ctx.lineTo(peer.x, peer.y);
          ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
          ctx.lineWidth = 1.2;
          ctx.stroke();

          // Relationship label capsule on midpoint
          if (peer.relationship) {
            const midX = (center.x + peer.x) / 2;
            const midY = (center.y + peer.y) / 2;
            ctx.font = "400 9.5px var(--font-sans), Inter, sans-serif";
            const tw = ctx.measureText(peer.relationship).width;
            ctx.fillStyle = "#121215";
            ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(midX - tw / 2 - 4, midY - 6, tw + 8, 12, 3);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = "#A1A1AA";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(peer.relationship, midX, midY);
          }
          ctx.restore();
        }
      }

      // Draw Nodes (Attio/Linear style)
      for (const node of nodes) {
        const isHovered = hoveredNode?.id === node.id;
        const colors =
          node.category !== "COMPANY"
            ? CATEGORY_COLORS[node.category] || CATEGORY_COLORS.OTHER
            : { dot: "#A1A1AA" };

        ctx.save();

        // Circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = node.isCenter ? "#FFFFFF" : isHovered ? "#222226" : "#141417";
        ctx.fill();

        ctx.strokeStyle = node.isCenter ? "#FFFFFF" : isHovered ? "rgba(255, 255, 255, 0.3)" : "rgba(255, 255, 255, 0.12)";
        ctx.lineWidth = node.isCenter ? 2 : 1.2;
        ctx.stroke();

        // Category dot on node
        if (!node.isCenter) {
          ctx.beginPath();
          ctx.arc(node.x + node.radius * 0.65, node.y - node.radius * 0.65, 3, 0, Math.PI * 2);
          ctx.fillStyle = colors.dot;
          ctx.fill();
          ctx.strokeStyle = "#141417";
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Initials
        ctx.fillStyle = node.isCenter ? "#09090B" : "#E4E4E7";
        ctx.font = node.isCenter ? "500 11px var(--font-sans), Inter, sans-serif" : "500 9px var(--font-sans), Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(initials(node.name), node.x, node.y + 0.5);

        // Label below
        ctx.font = "400 10.5px var(--font-sans), Inter, sans-serif";
        ctx.fillStyle = node.isCenter ? "#FFFFFF" : "#A1A1AA";
        ctx.fillText(
          node.name.length > 15 ? `${node.name.slice(0, 13)}...` : node.name,
          node.x,
          node.y + node.radius + 11
        );

        ctx.restore();
      }

      ctx.restore();
      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [hoveredNode]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    for (const node of nodesRef.current) {
      const dx = x - node.x;
      const dy = y - node.y;
      if (dx * dx + dy * dy <= node.radius * node.radius) {
        if (!node.isCenter) {
          router.push(`/contacts/${node.id}`);
        }
        break;
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let found: GraphNodeItem | null = null;
    for (const node of nodesRef.current) {
      const dx = x - node.x;
      const dy = y - node.y;
      if (dx * dx + dy * dy <= node.radius * node.radius) {
        found = node;
        break;
      }
    }
    setHoveredNode(found);
  };

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-zinc-900/30 p-4 transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Share2 className="size-3.5 text-zinc-400" />
          <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
            {t("graph.localGraph")}
          </h3>
          <span className="rounded-md border border-white/[0.06] bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-400 font-mono">
            {allPeers.length}
          </span>
        </div>
        <Button
          size="sm"
          onClick={() => setIsConnectOpen(true)}
          className="h-6.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 gap-1 rounded-md"
        >
          <Plus className="size-3" />
          {t("graph.add")}
        </Button>
      </div>

      {allPeers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center text-xs text-zinc-500">
          <p>{t("graph.noDirectConnections")}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsConnectOpen(true)}
            className="mt-2.5 border-zinc-800 bg-zinc-900 text-xs text-zinc-300 gap-1.5"
          >
            <Plus className="size-3" />
            {t("graph.connect")}
          </Button>
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={() => setHoveredNode(null)}
          className="block w-full h-[300px] cursor-pointer rounded-lg bg-zinc-950/60 border border-white/[0.04]"
        />
      )}

      <AddConnectionDialog
        open={isConnectOpen}
        onOpenChange={setIsConnectOpen}
        fromContact={{ id: currentContact.id, name: currentContact.fullName }}
        availableContacts={otherAvailableContacts}
        onSuccess={() => {
          router.refresh();
        }}
      />
    </div>
  );
}
