"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sliders,
  RefreshCw,
  Building2,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORY_COLORS, CATEGORY_LABELS, initials } from "@/lib/contact-display";
import type { ContactCategory } from "@/generated/prisma/enums";
import type { FullGraphData, GraphNode, GraphContactNode, GraphCompanyNode, GraphLink } from "@/lib/data/graph";
import { NodeInspector } from "@/components/graph/node-inspector";

export type SimNode = GraphNode & {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  pinned?: boolean;
};

export interface SimLink extends GraphLink {
  sourceNode?: SimNode;
  targetNode?: SimNode;
}

interface NetworkGraphProps {
  initialData: FullGraphData;
}

export function NetworkGraph({ initialData }: NetworkGraphProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniMapCanvasRef = useRef<HTMLCanvasElement>(null);

  // State
  const [graphData, setGraphData] = useState<FullGraphData>(initialData);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ContactCategory | "ALL">("ALL");
  const [minScore, setMinScore] = useState<number>(1);
  const [showCompanyNodes, setShowCompanyNodes] = useState<boolean>(true);
  const [showParticles, setShowParticles] = useState<boolean>(true);
  const [isPhysicsPaused, setIsPhysicsPaused] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [showControlsMenu, setShowControlsMenu] = useState<boolean>(false);

  // Camera transform state (pan & zoom)
  const cameraRef = useRef<{ x: number; y: number; zoom: number }>({ x: 0, y: 0, zoom: 1 });
  const targetCameraRef = useRef<{ x: number; y: number; zoom: number } | null>(null);

  // Dragging state
  const dragRef = useRef<{
    isDragging: boolean;
    draggedNode: SimNode | null;
    startX: number;
    startY: number;
    lastMouseX: number;
    lastMouseY: number;
    isPanning: boolean;
  }>({
    isDragging: false,
    draggedNode: null,
    startX: 0,
    startY: 0,
    lastMouseX: 0,
    lastMouseY: 0,
    isPanning: false,
  });

  // Simulation nodes and links
  const simNodesRef = useRef<SimNode[]>([]);
  const simLinksRef = useRef<SimLink[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const alphaRef = useRef<number>(1.0);
  const particleOffsetRef = useRef<number>(0);

  // Re-fetch graph data on demand
  const refreshGraph = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/graph");
      if (res.ok) {
        const data: FullGraphData = await res.json();
        setGraphData(data);
        if (selectedNode) {
          const updated = data.nodes.find((n) => n.id === selectedNode.id);
          setSelectedNode(updated || null);
        }
      }
    } catch (e) {
      console.error("Failed to refresh graph data:", e);
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedNode]);

  // Filtered nodes and links based on UI filters
  const { filteredNodes, filteredLinks } = useMemo(() => {
    const rawNodes = graphData.nodes;
    const rawLinks = graphData.links;

    const visibleNodes = rawNodes.filter((node) => {
      // 1. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = node.name.toLowerCase().includes(q);
        const matchesRole =
          node.nodeType === "contact" &&
          (node as GraphContactNode).role?.toLowerCase().includes(q);
        const matchesCompany =
          node.nodeType === "contact" &&
          (node as GraphContactNode).companyName?.toLowerCase().includes(q);
        if (!matchesName && !matchesRole && !matchesCompany) return false;
      }

      // 2. Company Node toggle
      if (node.nodeType === "company" && !showCompanyNodes) {
        return false;
      }

      // 3. Category Filter
      if (
        node.nodeType === "contact" &&
        selectedCategory !== "ALL" &&
        (node as GraphContactNode).category !== selectedCategory
      ) {
        return false;
      }

      // 4. Min Usefulness Score Filter
      if (
        node.nodeType === "contact" &&
        minScore > 1 &&
        ((node as GraphContactNode).usefulnessScore ?? 0) < minScore
      ) {
        return false;
      }

      return true;
    });

    const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));

    const visibleLinks = rawLinks.filter((link) => {
      if (!visibleNodeIds.has(link.source) || !visibleNodeIds.has(link.target)) {
        return false;
      }
      if (link.type === "company_hub" && !showCompanyNodes) {
        return false;
      }
      return true;
    });

    return { filteredNodes: visibleNodes, filteredLinks: visibleLinks };
  }, [graphData, searchQuery, selectedCategory, minScore, showCompanyNodes]);

  // Initialize or re-sync physics simulation nodes & links
  useEffect(() => {
    const width = containerRef.current?.clientWidth || 900;
    const height = containerRef.current?.clientHeight || 650;

    const existingMap = new Map<string, SimNode>();
    for (const n of simNodesRef.current) {
      existingMap.set(n.id, n);
    }

    const count = Math.max(1, filteredNodes.length);
    const newSimNodes: SimNode[] = filteredNodes.map((node, i) => {
      const existing = existingMap.get(node.id);
      if (existing) {
        return {
          ...node,
          x: existing.x,
          y: existing.y,
          vx: existing.vx,
          vy: existing.vy,
          radius: node.nodeType === "company" ? 22 : Math.max(15, Math.min(24, ((node as GraphContactNode).usefulnessScore || 5) * 1.5 + 10)),
          pinned: existing.pinned,
        };
      }

      // Distribute radially with generous initial spacing
      const angle = (i / count) * Math.PI * 2;
      const ring = 160 + (i % 3) * 70;
      return {
        ...node,
        x: width / 2 + Math.cos(angle) * ring,
        y: height / 2 + Math.sin(angle) * ring,
        vx: 0,
        vy: 0,
        radius: node.nodeType === "company" ? 22 : Math.max(15, Math.min(24, ((node as GraphContactNode).usefulnessScore || 5) * 1.5 + 10)),
      };
    });

    const nodeMap = new Map<string, SimNode>(newSimNodes.map((n) => [n.id, n]));

    const newSimLinks: SimLink[] = filteredLinks
      .map((link) => ({
        ...link,
        sourceNode: nodeMap.get(link.source),
        targetNode: nodeMap.get(link.target),
      }))
      .filter((link): link is SimLink & { sourceNode: SimNode; targetNode: SimNode } => Boolean(link.sourceNode && link.targetNode));

    simNodesRef.current = newSimNodes;
    simLinksRef.current = newSimLinks;
    alphaRef.current = 1.0;
  }, [filteredNodes, filteredLinks]);

  // Coordinate Conversion Helpers
  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    const { x, y, zoom } = cameraRef.current;
    return {
      x: (screenX - x) / zoom,
      y: (screenY - y) / zoom,
    };
  }, []);

  // Center & Fit graph view to screen
  const fitToScreen = useCallback(() => {
    if (!containerRef.current || simNodesRef.current.length === 0) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;

    for (const node of simNodesRef.current) {
      minX = Math.min(minX, node.x - node.radius);
      maxX = Math.max(maxX, node.x + node.radius);
      minY = Math.min(minY, node.y - node.radius);
      maxY = Math.max(maxY, node.y + node.radius);
    }

    const graphWidth = maxX - minX || 1;
    const graphHeight = maxY - minY || 1;
    const padding = 100;

    const zoomX = (width - padding * 2) / Math.max(graphWidth, 400);
    const zoomY = (height - padding * 2) / Math.max(graphHeight, 400);
    const newZoom = Math.max(0.4, Math.min(1.1, Math.min(zoomX, zoomY)));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    targetCameraRef.current = {
      x: width / 2 - centerX * newZoom,
      y: height / 2 - centerY * newZoom,
      zoom: newZoom,
    };
  }, []);

  // Auto-fit to screen after initial mount
  useEffect(() => {
    const timer = setTimeout(() => {
      fitToScreen();
    }, 200);
    return () => clearTimeout(timer);
  }, [fitToScreen]);

  // Hit-testing helper
  const getNodeAtPoint = (screenX: number, screenY: number): SimNode | null => {
    const world = screenToWorld(screenX, screenY);
    for (let i = simNodesRef.current.length - 1; i >= 0; i--) {
      const node = simNodesRef.current[i]!;
      const dx = node.x - world.x;
      const dy = node.y - world.y;
      const hitRadius = node.radius + 6;
      if (dx * dx + dy * dy <= hitRadius * hitRadius) {
        return node;
      }
    }
    return null;
  };

  // Main Canvas Render & Simulation Loop
  useEffect(() => {
    let isRunning = true;

    const render = () => {
      if (!isRunning) return;

      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const width = container.clientWidth;
      const height = container.clientHeight;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      if (targetCameraRef.current) {
        const target = targetCameraRef.current;
        const current = cameraRef.current;
        current.x += (target.x - current.x) * 0.12;
        current.y += (target.y - current.y) * 0.12;
        current.zoom += (target.zoom - current.zoom) * 0.12;

        if (
          Math.abs(target.x - current.x) < 0.5 &&
          Math.abs(target.y - current.y) < 0.5 &&
          Math.abs(target.zoom - current.zoom) < 0.005
        ) {
          current.x = target.x;
          current.y = target.y;
          current.zoom = target.zoom;
          targetCameraRef.current = null;
        }
      }

      // PHYSICS STEP
      if (!isPhysicsPaused && alphaRef.current > 0.001) {
        const nodes = simNodesRef.current;
        const links = simLinksRef.current;
        const alpha = alphaRef.current;

        // 1. Repulsion between all node pairs
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i]!;
            const b = nodes[j]!;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const distSq = dx * dx + dy * dy + 1;
            const dist = Math.sqrt(distSq);

            const charge = 12000;
            const repulsion = (charge / distSq) * alpha;
            const fx = (dx / dist) * repulsion;
            const fy = (dy / dist) * repulsion;

            if (!a.pinned) {
              a.vx -= fx;
              a.vy -= fy;
            }
            if (!b.pinned) {
              b.vx += fx;
              b.vy += fy;
            }

            // Hard collision prevention buffer
            const minDist = a.radius + b.radius + 35;
            if (dist < minDist) {
              const overlap = (minDist - dist) * 0.5 * alpha;
              const ox = (dx / dist) * overlap;
              const oy = (dy / dist) * overlap;
              if (!a.pinned) {
                a.x -= ox;
                a.y -= oy;
              }
              if (!b.pinned) {
                b.x += ox;
                b.y += oy;
              }
            }
          }
        }

        // 2. Link Spring Forces
        for (const link of links) {
          if (!link.sourceNode || !link.targetNode) continue;
          const a = link.sourceNode;
          const b = link.targetNode;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;

          const targetDist = link.type === "company_hub" ? 140 : link.type === "direct" ? 180 : 160;
          const strength = 0.035 * alpha;
          const force = (dist - targetDist) * strength;

          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          // Pull together if dist > targetDist (force > 0), push apart if dist < targetDist
          if (!a.pinned) {
            a.vx += fx;
            a.vy += fy;
          }
          if (!b.pinned) {
            b.vx -= fx;
            b.vy -= fy;
          }
        }

        // 3. Gentle Center Gravity & Damping
        const centerX = width / 2;
        const centerY = height / 2;
        for (const node of nodes) {
          if (!node.pinned) {
            const dx = centerX - node.x;
            const dy = centerY - node.y;
            node.vx += dx * 0.0015 * alpha;
            node.vy += dy * 0.0015 * alpha;

            node.vx *= 0.85;
            node.vy *= 0.85;

            node.x += node.vx;
            node.y += node.vy;
          }
        }

        alphaRef.current *= 0.99;
        if (alphaRef.current < 0.001) {
          alphaRef.current = 0;
        }
      }

      particleOffsetRef.current = (particleOffsetRef.current + 0.006) % 1;

      // DRAW GRAPH
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const { x: camX, y: camY, zoom } = cameraRef.current;
      ctx.translate(camX, camY);
      ctx.scale(zoom, zoom);

      const hoveredId = hoveredNode?.id;
      const selectedId = selectedNode?.id;
      const activeId = hoveredId || selectedId;

      const connectedNodeIds = new Set<string>();
      if (activeId) {
        connectedNodeIds.add(activeId);
        for (const link of simLinksRef.current) {
          if (link.sourceNode?.id === activeId && link.targetNode) {
            connectedNodeIds.add(link.targetNode.id);
          }
          if (link.targetNode?.id === activeId && link.sourceNode) {
            connectedNodeIds.add(link.sourceNode.id);
          }
        }
      }

      // 1. DRAW EDGES / LINKS
      for (const link of simLinksRef.current) {
        if (!link.sourceNode || !link.targetNode) continue;
        const a = link.sourceNode;
        const b = link.targetNode;

        const isLinkActive = activeId && (a.id === activeId || b.id === activeId);
        const isDimmed = activeId && !isLinkActive;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);

        if (isLinkActive) {
          ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
          ctx.lineWidth = 1.8;
        } else if (isDimmed) {
          ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
          ctx.lineWidth = 1;
        } else {
          if (link.type === "company_hub") {
            ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
            ctx.lineWidth = 1.2;
          } else if (link.type === "direct") {
            ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
            ctx.lineWidth = 1.2 + (link.strength || 1) * 0.2;
          } else {
            ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
          }
        }

        ctx.stroke();
        ctx.restore();

        // Flow Particles on active links
        if (showParticles && (!isDimmed || isLinkActive)) {
          const t = (particleOffsetRef.current + (link.id.charCodeAt(0) % 10) * 0.1) % 1;
          const px = a.x + (b.x - a.x) * t;
          const py = a.y + (b.y - a.y) * t;

          ctx.save();
          ctx.beginPath();
          ctx.arc(px, py, isLinkActive ? 2 : 1.2, 0, Math.PI * 2);
          ctx.fillStyle = isLinkActive ? "#FFFFFF" : "rgba(255, 255, 255, 0.25)";
          ctx.fill();
          ctx.restore();
        }

        // Relationship label capsule on active link
        if (isLinkActive && link.relationship && zoom > 0.6) {
          const midX = (a.x + b.x) / 2;
          const midY = (a.y + b.y) / 2;

          ctx.save();
          ctx.font = "400 10.5px var(--font-sans), Inter, sans-serif";
          const textMetrics = ctx.measureText(link.relationship);
          const padX = 6;
          const padY = 3;

          ctx.fillStyle = "#121215";
          ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(
            midX - textMetrics.width / 2 - padX,
            midY - 6 - padY,
            textMetrics.width + padX * 2,
            12 + padY * 2,
            4
          );
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#E4E4E7";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(link.relationship, midX, midY);
          ctx.restore();
        }
      }

      // 2. DRAW NODES
      for (const node of simNodesRef.current) {
        const isHovered = hoveredNode?.id === node.id;
        const isSelected = selectedNode?.id === node.id;
        const isConnected = connectedNodeIds.has(node.id);
        const isDimmed = activeId && !isConnected;

        ctx.save();
        ctx.globalAlpha = isDimmed ? 0.12 : 1.0;

        if (node.nodeType === "company") {
          const r = node.radius;

          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
          ctx.fillStyle = isSelected
            ? "#27272A"
            : isHovered
            ? "#1E1E22"
            : "#141417";
          ctx.fill();

          ctx.strokeStyle = isSelected
            ? "#FFFFFF"
            : isHovered
            ? "rgba(255, 255, 255, 0.3)"
            : "rgba(255, 255, 255, 0.14)";
          ctx.lineWidth = isSelected ? 2 : 1.2;
          ctx.stroke();

          // Vector Building Glyph
          ctx.save();
          ctx.strokeStyle = isSelected ? "#FFFFFF" : "#A1A1AA";
          ctx.lineWidth = 1.2;
          ctx.strokeRect(node.x - 6, node.y - 6, 12, 12);
          ctx.beginPath();
          ctx.moveTo(node.x - 2.5, node.y - 1.5);
          ctx.lineTo(node.x - 2.5, node.y + 2);
          ctx.moveTo(node.x + 2.5, node.y - 1.5);
          ctx.lineTo(node.x + 2.5, node.y + 2);
          ctx.stroke();
          ctx.restore();

          // Count Badge
          ctx.beginPath();
          ctx.arc(node.x + r * 0.7, node.y - r * 0.7, 7, 0, Math.PI * 2);
          ctx.fillStyle = "#27272A";
          ctx.fill();
          ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = "#E4E4E7";
          ctx.font = "500 8.5px var(--font-sans), Inter, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(node.contactCount), node.x + r * 0.7, node.y - r * 0.7);

          // Node Text Capsule
          if (zoom > 0.45) {
            ctx.font = "400 11px var(--font-sans), Inter, sans-serif";
            const textWidth = ctx.measureText(node.name).width;
            const padX = 5;

            ctx.fillStyle = "#121215";
            ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(node.x - textWidth / 2 - padX, node.y + r + 4, textWidth + padX * 2, 16, 4);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = "#FAFAFA";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(node.name, node.x, node.y + r + 12);
          }
        } else {
          const r = node.radius;
          const colors = CATEGORY_COLORS[node.category] || CATEGORY_COLORS.OTHER;

          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
          ctx.fillStyle = isSelected
            ? "#FFFFFF"
            : isHovered
            ? "#222226"
            : "#141417";
          ctx.fill();

          ctx.strokeStyle = isSelected
            ? "#FFFFFF"
            : isHovered
            ? "rgba(255, 255, 255, 0.3)"
            : "rgba(255, 255, 255, 0.12)";
          ctx.lineWidth = isSelected ? 2 : 1.2;
          ctx.stroke();

          // Category dot indicator on node top right
          ctx.beginPath();
          ctx.arc(node.x + r * 0.65, node.y - r * 0.65, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = colors.dot;
          ctx.fill();
          ctx.strokeStyle = "#141417";
          ctx.lineWidth = 1.2;
          ctx.stroke();

          // Initials
          ctx.fillStyle = isSelected ? "#09090B" : "#E4E4E7";
          ctx.font = "500 10px var(--font-sans), Inter, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(initials(node.name), node.x, node.y + 0.5);

          if (zoom > 0.5) {
            ctx.font = "400 11px var(--font-sans), Inter, sans-serif";
            const textWidth = ctx.measureText(node.name).width;
            const padX = 5;

            ctx.fillStyle = "#121215";
            ctx.strokeStyle = isSelected ? "rgba(255, 255, 255, 0.3)" : "rgba(255, 255, 255, 0.08)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(node.x - textWidth / 2 - padX, node.y + r + 4, textWidth + padX * 2, 16, 4);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = "#FAFAFA";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(node.name, node.x, node.y + r + 12);

            if (zoom > 0.75) {
              const subtext = node.companyName
                ? `${node.companyName}${node.role ? ` · ${node.role}` : ""}`
                : node.role || "";

              if (subtext) {
                const subStr = subtext.length > 22 ? `${subtext.slice(0, 20)}...` : subtext;
                ctx.font = "400 9px var(--font-sans), Inter, sans-serif";
                ctx.fillStyle = "#A1A1AA";
                ctx.fillText(subStr, node.x, node.y + r + 26);
              }
            }
          }
        }

        ctx.restore();
      }

      ctx.restore();
      renderMiniMap();

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPhysicsPaused, showParticles, selectedNode, hoveredNode]);

  const renderMiniMap = () => {
    const miniCanvas = miniMapCanvasRef.current;
    if (!miniCanvas) return;
    const miniCtx = miniCanvas.getContext("2d");
    if (!miniCtx) return;

    const mw = miniCanvas.width;
    const mh = miniCanvas.height;
    miniCtx.clearRect(0, 0, mw, mh);

    if (simNodesRef.current.length === 0) return;

    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const n of simNodesRef.current) {
      minX = Math.min(minX, n.x);
      maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y);
      maxY = Math.max(maxY, n.y);
    }

    const pad = 30;
    const gw = maxX - minX + pad * 2 || 1;
    const gh = maxY - minY + pad * 2 || 1;
    const scale = Math.min(mw / gw, mh / gh);

    const mapX = (x: number) => (x - minX + pad) * scale;
    const mapY = (y: number) => (y - minY + pad) * scale;

    miniCtx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    miniCtx.lineWidth = 0.8;
    for (const l of simLinksRef.current) {
      if (!l.sourceNode || !l.targetNode) continue;
      miniCtx.beginPath();
      miniCtx.moveTo(mapX(l.sourceNode.x), mapY(l.sourceNode.y));
      miniCtx.lineTo(mapX(l.targetNode.x), mapY(l.targetNode.y));
      miniCtx.stroke();
    }

    for (const n of simNodesRef.current) {
      miniCtx.beginPath();
      miniCtx.arc(mapX(n.x), mapY(n.y), n.nodeType === "company" ? 2 : 1.5, 0, Math.PI * 2);
      miniCtx.fillStyle =
        n.nodeType === "company"
          ? "#71717A"
          : CATEGORY_COLORS[n.category]?.dot || "#A1A1AA";
      miniCtx.fill();
    }

    if (containerRef.current) {
      const { x: camX, y: camY, zoom } = cameraRef.current;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;

      const vpLeft = -camX / zoom;
      const vpTop = -camY / zoom;
      const vpRight = (w - camX) / zoom;
      const vpBottom = (h - camY) / zoom;

      miniCtx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      miniCtx.lineWidth = 1;
      miniCtx.strokeRect(
        mapX(vpLeft),
        mapY(vpTop),
        (vpRight - vpLeft) * scale,
        (vpBottom - vpTop) * scale
      );
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const clickedNode = getNodeAtPoint(clientX, clientY);

    if (clickedNode) {
      dragRef.current = {
        isDragging: true,
        draggedNode: clickedNode,
        startX: clientX,
        startY: clientY,
        lastMouseX: clientX,
        lastMouseY: clientY,
        isPanning: false,
      };
      clickedNode.pinned = true;
      alphaRef.current = 0.5;
    } else {
      dragRef.current = {
        isDragging: true,
        draggedNode: null,
        startX: clientX,
        startY: clientY,
        lastMouseX: clientX,
        lastMouseY: clientY,
        isPanning: true,
      };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    if (dragRef.current.isDragging) {
      const dx = clientX - dragRef.current.lastMouseX;
      const dy = clientY - dragRef.current.lastMouseY;
      dragRef.current.lastMouseX = clientX;
      dragRef.current.lastMouseY = clientY;

      if (dragRef.current.draggedNode) {
        const world = screenToWorld(clientX, clientY);
        dragRef.current.draggedNode.x = world.x;
        dragRef.current.draggedNode.y = world.y;
        dragRef.current.draggedNode.vx = 0;
        dragRef.current.draggedNode.vy = 0;
        alphaRef.current = 0.4;
      } else if (dragRef.current.isPanning) {
        cameraRef.current.x += dx;
        cameraRef.current.y += dy;
        targetCameraRef.current = null;
      }
    } else {
      const node = getNodeAtPoint(clientX, clientY);
      setHoveredNode(node);
      if (node) {
        setTooltipPos({ x: clientX + 15, y: clientY + 15 });
      } else {
        setTooltipPos(null);
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const dragDist = Math.hypot(
      clientX - dragRef.current.startX,
      clientY - dragRef.current.startY
    );

    if (dragDist < 6) {
      const clickedNode = getNodeAtPoint(clientX, clientY);
      if (clickedNode) {
        setSelectedNode(clickedNode);
      } else {
        setSelectedNode(null);
      }
    }

    if (dragRef.current.draggedNode) {
      dragRef.current.draggedNode.pinned = false;
    }

    dragRef.current.isDragging = false;
    dragRef.current.draggedNode = null;
    dragRef.current.isPanning = false;
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const node = getNodeAtPoint(clientX, clientY);
    if (node && node.nodeType === "contact") {
      router.push(`/contacts/${node.id}`);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const newZoom = Math.min(3.5, Math.max(0.25, cameraRef.current.zoom * zoomFactor));

    const worldBefore = screenToWorld(clientX, clientY);
    cameraRef.current.zoom = newZoom;
    cameraRef.current.x = clientX - worldBefore.x * newZoom;
    cameraRef.current.y = clientY - worldBefore.y * newZoom;
    targetCameraRef.current = null;
  };

  const handleZoom = (direction: "in" | "out") => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const factor = direction === "in" ? 1.3 : 0.77;
    const newZoom = Math.min(3.5, Math.max(0.25, cameraRef.current.zoom * factor));

    const worldCenter = screenToWorld(width / 2, height / 2);
    targetCameraRef.current = {
      x: width / 2 - worldCenter.x * newZoom,
      y: height / 2 - worldCenter.y * newZoom,
      zoom: newZoom,
    };
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    setTimeout(fitToScreen, 150);
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden rounded-xl border border-white/[0.08] graph-canvas-bg transition-all duration-200 ${
        isFullscreen ? "fixed inset-0 z-50 h-screen rounded-none" : "h-[700px]"
      }`}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        className="block size-full cursor-grab active:cursor-grabbing"
      />

      {/* TOP HEADER CONTROLS BAR */}
      <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-1.5">
        <div className="relative w-52 sm:w-60 max-w-[calc(100vw-8rem)]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Пошук у графі..."
            className="pl-8 pr-3 h-7 bg-zinc-900/90 border-white/[0.08] text-xs text-white placeholder:text-zinc-500 rounded-md focus:border-zinc-500"
          />
        </div>

        <div className="hidden lg:flex items-center gap-0.5 bg-zinc-900/90 p-0.5 rounded-md border border-white/[0.08]">
          <button
            onClick={() => setSelectedCategory("ALL")}
            className={`px-2 py-0.5 text-[11px] font-normal rounded transition-colors ${
              selectedCategory === "ALL"
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Всі ({graphData.stats.totalContacts})
          </button>
          {(["VIP", "INVESTOR", "LEAD", "COLLEAGUE", "FRIEND", "HR"] as ContactCategory[]).map((cat) => {
            const count = graphData.stats.categoryCounts[cat] || 0;
            if (count === 0) return null;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(selectedCategory === cat ? "ALL" : cat)}
                className={`flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-normal rounded transition-colors ${
                  selectedCategory === cat
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: CATEGORY_COLORS[cat].dot }}
                />
                {CATEGORY_LABELS[cat]}
                <span className="text-[10px] text-zinc-500 font-mono">{count}</span>
              </button>
            );
          })}
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowControlsMenu(!showControlsMenu)}
          className="h-7 px-2 bg-zinc-900/90 border-white/[0.08] text-zinc-300 hover:text-white rounded-md text-xs gap-1.5"
        >
          <Sliders className="size-3" />
          <span>Фільтри</span>
        </Button>
      </div>

      {/* FLOATING FILTER & PHYSICS POPUP */}
      {showControlsMenu && (
        <div className="absolute top-12 left-3 z-30 w-60 rounded-lg border border-white/[0.08] bg-zinc-900/95 p-3 shadow-xl backdrop-blur-xl text-xs space-y-2.5">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-1.5">
            <span className="font-medium text-white flex items-center gap-1.5 text-xs">
              <Sliders className="size-3 text-zinc-400" />
              Параметри
            </span>
            <button
              onClick={() => setShowControlsMenu(false)}
              className="text-zinc-400 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-zinc-400 text-[11px]">
              <span>Мін. оцінка:</span>
              <span className="font-mono text-zinc-200">{minScore} / 10</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-full accent-white h-1 bg-zinc-800 rounded"
            />
          </div>

          <div className="flex items-center justify-between py-0.5">
            <span className="text-zinc-300 flex items-center gap-1.5 text-xs">
              <Building2 className="size-3 text-zinc-400" />
              Компанії
            </span>
            <button
              onClick={() => setShowCompanyNodes(!showCompanyNodes)}
              className={`relative inline-flex h-3.5 w-6.5 shrink-0 cursor-pointer rounded-full transition-colors ${
                showCompanyNodes ? "bg-zinc-200" : "bg-zinc-700"
              }`}
            >
              <span
                className={`inline-block size-2.5 rounded-full ${
                  showCompanyNodes ? "bg-zinc-950 translate-x-3 translate-y-0.5" : "bg-zinc-400 translate-x-0.5 translate-y-0.5"
                } transition-transform`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between py-0.5">
            <span className="text-zinc-300 flex items-center gap-1.5 text-xs">
              <Zap className="size-3 text-zinc-400" />
              Анімація
            </span>
            <button
              onClick={() => setShowParticles(!showParticles)}
              className={`relative inline-flex h-3.5 w-6.5 shrink-0 cursor-pointer rounded-full transition-colors ${
                showParticles ? "bg-zinc-200" : "bg-zinc-700"
              }`}
            >
              <span
                className={`inline-block size-2.5 rounded-full ${
                  showParticles ? "bg-zinc-950 translate-x-3 translate-y-0.5" : "bg-zinc-400 translate-x-0.5 translate-y-0.5"
                } transition-transform`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-white/[0.06]">
            <span className="text-zinc-400 text-[11px]">Фізика</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsPhysicsPaused(!isPhysicsPaused)}
              className="h-5 text-[10px] px-2 bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white"
            >
              {isPhysicsPaused ? "Відновити" : "Заморозити"}
            </Button>
          </div>
        </div>
      )}

      {/* TOP RIGHT STATS HUD BAR */}
      <div className="absolute top-3 right-3 z-20 hidden md:flex items-center gap-2 bg-zinc-900/90 px-2.5 py-1 rounded-md border border-white/[0.08] text-xs">
        <div className="flex items-center gap-1.5 text-zinc-300">
          <span className="size-1.5 rounded-full bg-zinc-400" />
          <span className="text-white font-medium tabular-nums">{filteredNodes.length}</span>
          <span className="text-zinc-500">вузлів</span>
        </div>
        <span className="text-zinc-700">•</span>
        <div className="flex items-center gap-1 text-zinc-300">
          <span className="text-white font-medium tabular-nums">{filteredLinks.length}</span>
          <span className="text-zinc-500">зв&apos;язків</span>
        </div>
        <span className="text-zinc-700">•</span>
        <button
          onClick={refreshGraph}
          disabled={isRefreshing}
          className="text-zinc-400 hover:text-white p-0.5 transition-colors"
          title="Оновити граф"
        >
          <RefreshCw className={`size-3 ${isRefreshing ? "animate-spin text-zinc-200" : ""}`} />
        </button>
      </div>

      {/* BOTTOM LEFT CAMERA CONTROLS BAR */}
      <div className="absolute bottom-3 left-3 z-20 flex items-center gap-0.5 bg-zinc-900/90 p-0.5 rounded-md border border-white/[0.08]">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => handleZoom("in")}
          className="size-6 rounded text-zinc-400 hover:text-white hover:bg-white/10"
          title="Збільшити"
        >
          <ZoomIn className="size-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => handleZoom("out")}
          className="size-6 rounded text-zinc-400 hover:text-white hover:bg-white/10"
          title="Зменшити"
        >
          <ZoomOut className="size-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={fitToScreen}
          className="size-6 rounded text-zinc-400 hover:text-white hover:bg-white/10"
          title="Центрувати"
        >
          <RotateCcw className="size-3" />
        </Button>
        <div className="h-3 w-px bg-white/[0.08] mx-0.5" />
        <Button
          size="icon"
          variant="ghost"
          onClick={toggleFullscreen}
          className="size-6 rounded text-zinc-400 hover:text-white hover:bg-white/10"
          title="Повний екран"
        >
          {isFullscreen ? <Minimize2 className="size-3" /> : <Maximize2 className="size-3" />}
        </Button>
      </div>

      {/* BOTTOM RIGHT MINI-MAP NAVIGATOR */}
      <div className="absolute bottom-3 right-3 z-20 hidden sm:block rounded-md border border-white/[0.08] bg-zinc-900/95 p-1">
        <canvas
          ref={miniMapCanvasRef}
          width={100}
          height={65}
          className="rounded bg-zinc-950 block"
        />
      </div>

      {/* HOVER TOOLTIP */}
      {hoveredNode && tooltipPos && !selectedNode && (
        <div
          className="pointer-events-none fixed z-40 w-52 rounded-lg border border-white/[0.08] bg-zinc-900/98 p-2.5 text-xs text-white shadow-xl transition-opacity duration-150"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
          }}
        >
          {hoveredNode.nodeType === "contact" ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-white truncate">{hoveredNode.name}</span>
                <span className="inline-flex items-center gap-1 rounded bg-zinc-800 px-1.5 py-0.2 text-[10px] text-zinc-300">
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[hoveredNode.category].dot }}
                  />
                  {CATEGORY_LABELS[hoveredNode.category]}
                </span>
              </div>
              {hoveredNode.role && (
                <p className="text-zinc-400 text-[11px]">{hoveredNode.role}</p>
              )}
              {hoveredNode.companyName && (
                <p className="text-zinc-300 text-[11px]">{hoveredNode.companyName}</p>
              )}
              {hoveredNode.usefulnessScore != null && (
                <p className="text-zinc-400 text-[11px] font-mono">
                  ★ {hoveredNode.usefulnessScore} / 10
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-0.5">
              <div className="font-medium text-white">{hoveredNode.name}</div>
              <p className="text-zinc-400 text-[11px]">
                {hoveredNode.contactCount} контактів
              </p>
            </div>
          )}
        </div>
      )}

      {/* NODE INSPECTOR SLIDE-OVER DRAWER */}
      {selectedNode && (
        <NodeInspector
          node={selectedNode}
          allNodes={graphData.nodes}
          links={graphData.links}
          onClose={() => setSelectedNode(null)}
          onRefreshGraph={refreshGraph}
        />
      )}
    </div>
  );
}
