"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  Maximize2,
  Minimize2,
  Sliders,
  RefreshCw,
  Zap,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORY_COLORS, initials } from "@/lib/contact-display";
import type { ContactCategory } from "@/generated/prisma/enums";
import type { FullGraphData, GraphNode, GraphContactNode, GraphLink } from "@/lib/data/graph";
import { NodeInspector } from "@/components/graph/node-inspector";
import { useTranslation } from "@/lib/i18n/context";

// Positions come from the server (src/lib/data/graph.ts runs a d3-force
// layout to convergence once per request) — this component never simulates,
// it only ever projects and draws. `x`/`y` start out as the server's values
// and only change from here on via manual drag (see `pinnedPositionsRef`).
export type SimNode = GraphNode & {
  x: number;
  y: number;
  radius: number;
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
  /** Last projection the mini-map was drawn with. The map re-fits its bounds
   * every frame, so a click can only be turned back into world coordinates
   * using the very mapping that produced the pixels under the cursor. */
  const miniMapProjRef = useRef<{ minX: number; minY: number; pad: number; scale: number } | null>(null);

  // A "View in graph" link from the contact detail page lands here with
  // `?focus=<contactId>` — computed as lazy initial state (not an effect),
  // so the node is selected and focused from the very first render, with no
  // unfocused-then-focused flash. An id that doesn't match any current node
  // is ignored rather than producing an empty-looking focused graph.
  const searchParams = useSearchParams();
  const initialFocusId = (() => {
    const requested = searchParams.get("focus");
    return requested && initialData.nodes.some((n) => n.id === requested) ? requested : null;
  })();

  // State
  const [graphData, setGraphData] = useState<FullGraphData>(initialData);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ContactCategory | "ALL">("ALL");
  const [minScore, setMinScore] = useState<number>(1);
  const [showParticles, setShowParticles] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(
    () => initialData.nodes.find((n) => n.id === initialFocusId) ?? null,
  );
  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [showControlsMenu, setShowControlsMenu] = useState<boolean>(false);
  const [zoomDisplay, setZoomDisplay] = useState<number>(1);
  // Per-type visibility toggles (Weave's `typeToggles`) — a type absent from
  // this map (the common case) is visible; only explicitly-hidden types are
  // listed, so a freshly-added node type is visible by default.
  const [hiddenTypes, setHiddenTypes] = useState<Partial<Record<GraphNode["nodeType"], boolean>>>({});
  const [collapseLeaf, setCollapseLeaf] = useState<boolean>(false);
  // Index into `components` below, or null for "All" — Weave's `compId`.
  const [selectedComponentIndex, setSelectedComponentIndex] = useState<number | null>(null);
  // Ego-network isolation from the inspector's "Focus" button — Weave's
  // `focusId`. Overrides every other visibility filter while set.
  const [focusNodeId, setFocusNodeId] = useState<string | null>(initialFocusId);

  const { t } = useTranslation();

  // Camera transform state (pan & zoom)
  const cameraRef = useRef<{ x: number; y: number; zoom: number }>({ x: 0, y: 0, zoom: 1 });
  const targetCameraRef = useRef<{ x: number; y: number; zoom: number } | null>(null);
  const lastZoomDisplayRef = useRef<number>(100);

  // Dragging state
  /** Live pointers by id — the second entry is what turns a drag into a pinch. */
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);
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

  // Rendered nodes/links — positions come from the server, this ref is a
  // draw-time cache, not a simulation state.
  const simNodesRef = useRef<SimNode[]>([]);
  const simLinksRef = useRef<SimLink[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const particleOffsetRef = useRef<number>(0);

  // Node positions the user has manually dragged, keyed by node id — these
  // override the server layout for that node on every subsequent data
  // refresh, so dragging isn't undone by e.g. adding a note. Nothing else is
  // ever "pinned": there's no simulation left to fight.
  const pinnedPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // True once the user pans/zooms/drags manually — after that, a container
  // resize re-projects the camera but no longer auto-refits it, so we don't
  // fight a deliberate view the user set up.
  const hasManualCameraRef = useRef(false);

  // Re-fetch graph data on demand
  const refreshGraph = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/graph");
      if (res.ok) {
        const data: FullGraphData = await res.json();
        setGraphData(data);
        // Functional update: reads whatever is selected *now*, not the
        // value captured when this closure was created. Without this, a
        // click on a different node while this fetch is in flight gets
        // silently overwritten by the stale node once the fetch resolves.
        setSelectedNode((prev) => (prev ? data.nodes.find((n) => n.id === prev.id) ?? null : prev));
      }
    } catch (e) {
      console.error("Failed to refresh graph data:", e);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Degree over the FULL, unfiltered graph — collapse-leaf-nodes hides nodes
  // by their true connectivity, not by whatever happens to still be visible
  // under the current type/category filters (mirrors Weave's precomputed
  // `e.degree`, set once in its `layout()`, not recomputed per filter pass).
  const degreeById = useMemo(() => {
    const map = new Map<string, number>();
    for (const link of graphData.links) {
      map.set(link.source, (map.get(link.source) ?? 0) + 1);
      map.set(link.target, (map.get(link.target) ?? 0) + 1);
    }
    return map;
  }, [graphData.links]);

  // Connected components over the full graph (Weave's disconnected-clusters
  // chips). Computed once from the unfiltered graph so component identity is
  // stable regardless of which types/categories are currently hidden.
  const { components, nodeComponentIndex } = useMemo(() => {
    const adjacency = new Map<string, string[]>();
    for (const node of graphData.nodes) adjacency.set(node.id, []);
    for (const link of graphData.links) {
      adjacency.get(link.source)?.push(link.target);
      adjacency.get(link.target)?.push(link.source);
    }

    const nodeComponentIndex = new Map<string, number>();
    const groups: string[][] = [];
    for (const node of graphData.nodes) {
      if (nodeComponentIndex.has(node.id)) continue;
      const group: string[] = [];
      const queue = [node.id];
      nodeComponentIndex.set(node.id, groups.length);
      while (queue.length > 0) {
        const current = queue.shift()!;
        group.push(current);
        for (const neighbor of adjacency.get(current) ?? []) {
          if (!nodeComponentIndex.has(neighbor)) {
            nodeComponentIndex.set(neighbor, groups.length);
            queue.push(neighbor);
          }
        }
      }
      groups.push(group);
    }

    const nodeIdSet = new Set(graphData.nodes.map((n) => n.id));
    const components = groups
      .map((ids, index) => ({
        index,
        ids,
        size: ids.length,
        links: graphData.links.filter((l) => nodeIdSet.has(l.source) && nodeComponentIndex.get(l.source) === index).length,
      }))
      .sort((a, b) => b.size - a.size);

    return { components, nodeComponentIndex };
  }, [graphData.nodes, graphData.links]);

  // Filtered nodes and links based on UI filters. Search is deliberately NOT
  // a removal filter — it only computes `searchMatchIds` below, which drives
  // highlighting + a pan/zoom-to-matches, so typing a query doesn't yank
  // nodes out of a (now static) layout on every keystroke. Type/category/
  // score/collapse/cluster-selection toggles stay true removal filters —
  // those are deliberate, infrequent actions where hiding nodes outright is
  // the point, and since layout is precomputed, removing nodes from the draw
  // list is just cheaper drawing, not a re-layout.
  const { filteredNodes, filteredLinks } = useMemo(() => {
    const rawNodes = graphData.nodes;
    const rawLinks = graphData.links;

    // Focus overrides every other filter — the inspector's "Focus" isolates
    // exactly one node's ego-network (itself + direct neighbors), regardless
    // of type/category/score/collapse/cluster state.
    if (focusNodeId) {
      const keepIds = new Set<string>([focusNodeId]);
      for (const link of rawLinks) {
        if (link.source === focusNodeId) keepIds.add(link.target);
        if (link.target === focusNodeId) keepIds.add(link.source);
      }
      const visibleNodes = rawNodes.filter((n) => keepIds.has(n.id));
      const visibleLinks = rawLinks.filter((l) => keepIds.has(l.source) && keepIds.has(l.target));
      return { filteredNodes: visibleNodes, filteredLinks: visibleLinks };
    }

    const visibleNodes = rawNodes.filter((node) => {
      if (hiddenTypes[node.nodeType]) {
        return false;
      }

      if (selectedComponentIndex !== null && nodeComponentIndex.get(node.id) !== selectedComponentIndex) {
        return false;
      }

      if (collapseLeaf && (degreeById.get(node.id) ?? 0) <= 1) {
        return false;
      }

      if (
        node.nodeType === "contact" &&
        selectedCategory !== "ALL" &&
        (node as GraphContactNode).category !== selectedCategory
      ) {
        return false;
      }

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

    const visibleLinks = rawLinks.filter((link) => visibleNodeIds.has(link.source) && visibleNodeIds.has(link.target));

    return { filteredNodes: visibleNodes, filteredLinks: visibleLinks };
  }, [graphData, selectedCategory, minScore, hiddenTypes, collapseLeaf, selectedComponentIndex, nodeComponentIndex, degreeById, focusNodeId]);

  // Search matches, computed separately from the removal filters above —
  // used for highlighting and for panning/zooming to the matched set.
  const searchMatchIds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    const matches = new Set<string>();
    for (const node of filteredNodes) {
      const matchesName = node.name.toLowerCase().includes(q);
      const matchesRole = node.nodeType === "contact" && Boolean((node as GraphContactNode).role?.toLowerCase().includes(q));
      const matchesCompany =
        node.nodeType === "contact" && Boolean((node as GraphContactNode).companyName?.toLowerCase().includes(q));
      if (matchesName || matchesRole || matchesCompany) matches.add(node.id);
    }
    return matches;
  }, [filteredNodes, searchQuery]);

  // Re-sync the drawable node/link list whenever filtered data changes.
  // Positions come straight from the server layout — the only override is a
  // node the user has manually dragged (`pinnedPositionsRef`), so this never
  // needs an "existing vs. new node" merge or an initial radial scatter the
  // way a live simulation did.
  useEffect(() => {
    const newSimNodes: SimNode[] = filteredNodes.map((node) => {
      const pinned = pinnedPositionsRef.current.get(node.id);
      return {
        ...node,
        x: pinned?.x ?? node.x,
        y: pinned?.y ?? node.y,
        radius:
          node.nodeType === "company" || node.nodeType === "community"
            ? 22
            : Math.max(15, Math.min(24, ((node as GraphContactNode).usefulnessScore || 5) * 1.5 + 10)),
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
  const fitToScreen = useCallback((nodesOverride?: SimNode[]) => {
    const targetNodes = nodesOverride ?? simNodesRef.current;
    if (!containerRef.current || targetNodes.length === 0) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;

    for (const node of targetNodes) {
      minX = Math.min(minX, node.x - node.radius);
      maxX = Math.max(maxX, node.x + node.radius);
      minY = Math.min(minY, node.y - node.radius);
      maxY = Math.max(maxY, node.y + node.radius);
    }

    const graphWidth = maxX - minX || 1;
    const graphHeight = maxY - minY || 1;
    // Proportional padding, floored so it can't eat a small canvas: a fixed
    // 100px inset leaves a 375px phone only ~175px to draw in, which is why
    // the graph used to land squashed in a corner there.
    const padding = Math.max(20, Math.min(100, Math.min(width, height) * 0.1));

    const zoomX = (width - padding * 2) / Math.max(graphWidth, 400);
    const zoomY = (height - padding * 2) / Math.max(graphHeight, 400);
    // The floor has to be low enough that a wide graph can actually fit on a
    // narrow screen; clamping at 0.4 guaranteed overflow with no way back.
    const newZoom = Math.max(0.15, Math.min(1.1, Math.min(zoomX, zoomY)));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    targetCameraRef.current = {
      x: width / 2 - centerX * newZoom,
      y: height / 2 - centerY * newZoom,
      zoom: newZoom,
    };
  }, []);

  // Auto-fit once real node data is in — tied to the data actually being
  // ready rather than a guessed delay. A fixed setTimeout here raced against
  // slower initial layouts (e.g. an extra client-side re-render from the
  // surrounding page chrome): if it fired before the container settled at
  // its final size, the camera would frame the wrong bounds and never
  // self-correct, leaving nodes rendered off-screen until a manual re-fit.
  useEffect(() => {
    if (!hasManualCameraRef.current) {
      fitToScreen();
    }
  }, [filteredNodes, filteredLinks, fitToScreen]);

  // Re-fit the camera when the container resizes — cheap now that layout is
  // precomputed (no re-simulation involved, just re-fitting to static
  // positions), but only while the user hasn't deliberately set up their own
  // view yet, so we don't override a manual pan/zoom/drag.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      if (!hasManualCameraRef.current) {
        fitToScreen();
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [fitToScreen]);

  // Pan/zoom to the search-matched set whenever it changes, so results are
  // visible without the user hunting for them manually.
  useEffect(() => {
    if (!searchMatchIds || searchMatchIds.size === 0) return;
    const matchedNodes = simNodesRef.current.filter((n) => searchMatchIds.has(n.id));
    if (matchedNodes.length > 0) fitToScreen(matchedNodes);
  }, [searchMatchIds, fitToScreen]);

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

  // Declared before the render effect below since that effect's `render`
  // closure calls it every frame — must exist before the closure is created,
  // not just before it first runs.
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
    miniMapProjRef.current = { minX, minY, pad, scale };

    miniCtx.strokeStyle = "rgba(27, 29, 33, 0.12)";
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
      miniCtx.arc(mapX(n.x), mapY(n.y), n.nodeType === "contact" ? 1.5 : 2, 0, Math.PI * 2);
      miniCtx.fillStyle =
        n.nodeType === "company" ? "#43A883" : n.nodeType === "community" ? "#9B7BE0" : CATEGORY_COLORS[n.category]?.dot || "#9A9A94";
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

      miniCtx.strokeStyle = "rgba(27, 29, 33, 0.45)";
      miniCtx.lineWidth = 1;
      miniCtx.strokeRect(
        mapX(vpLeft),
        mapY(vpTop),
        (vpRight - vpLeft) * scale,
        (vpBottom - vpTop) * scale
      );
    }
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

      // No physics step: positions are server-computed and only ever
      // change via a manual drag (handleMouseMove writes directly into the
      // dragged node's x/y). This loop is now pure draw + cosmetic motion.
      particleOffsetRef.current = (particleOffsetRef.current + 0.006) % 1;

      // Mirror the imperative camera zoom into React state for the on-screen
      // % readout — only on actual change, so this doesn't re-render every
      // frame while the camera is at rest.
      const roundedZoom = Math.round(cameraRef.current.zoom * 100);
      if (roundedZoom !== lastZoomDisplayRef.current) {
        lastZoomDisplayRef.current = roundedZoom;
        setZoomDisplay(roundedZoom);
      }

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

      // Hover/select (an ego-network of one node + its neighbors) takes
      // priority; with neither active, a live search's matches become the
      // highlighted set instead — so typing a query dims everything else
      // without ever removing nodes from the (now static) layout.
      const highlightedIds = new Set<string>();
      const isSearchHighlight = !activeId && Boolean(searchMatchIds && searchMatchIds.size > 0);
      if (activeId) {
        highlightedIds.add(activeId);
        for (const link of simLinksRef.current) {
          if (link.sourceNode?.id === activeId && link.targetNode) {
            highlightedIds.add(link.targetNode.id);
          }
          if (link.targetNode?.id === activeId && link.sourceNode) {
            highlightedIds.add(link.sourceNode.id);
          }
        }
      } else if (isSearchHighlight && searchMatchIds) {
        for (const id of searchMatchIds) highlightedIds.add(id);
      }
      const hasHighlight = activeId != null || isSearchHighlight;

      // 1. DRAW EDGES / LINKS
      for (const link of simLinksRef.current) {
        if (!link.sourceNode || !link.targetNode) continue;
        const a = link.sourceNode;
        const b = link.targetNode;

        const isLinkActive = activeId && (a.id === activeId || b.id === activeId);
        const isDimmed = hasHighlight && !(isLinkActive || (isSearchHighlight && highlightedIds.has(a.id) && highlightedIds.has(b.id)));

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);

        if (isLinkActive) {
          ctx.strokeStyle = "rgba(91, 141, 239, 0.85)";
          ctx.lineWidth = 1.8;
        } else if (isDimmed) {
          ctx.strokeStyle = "rgba(27, 29, 33, 0.04)";
          ctx.lineWidth = 1;
        } else {
          if (link.type === "company_hub" || link.type === "community_member") {
            ctx.strokeStyle = "rgba(27, 29, 33, 0.16)";
            ctx.lineWidth = 1.2;
          } else if (link.type === "direct") {
            ctx.strokeStyle = "rgba(27, 29, 33, 0.22)";
            ctx.lineWidth = 1.2 + (link.strength || 1) * 0.2;
          } else {
            ctx.strokeStyle = "rgba(27, 29, 33, 0.1)";
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
          ctx.fillStyle = isLinkActive ? "#5B8DEF" : "rgba(27, 29, 33, 0.3)";
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

          ctx.fillStyle = "#1B1D21";
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

          ctx.fillStyle = "#FFFFFF";
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
        const isConnected = highlightedIds.has(node.id);
        const isDimmed = hasHighlight && !isConnected;

        ctx.save();
        ctx.globalAlpha = isDimmed ? 0.12 : 1.0;

        if (node.nodeType === "company") {
          const r = node.radius;

          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
          ctx.fillStyle = isSelected
            ? "#B9E2CE"
            : isHovered
            ? "#D7EFE3"
            : "#E8F6F0";
          ctx.fill();

          ctx.strokeStyle = isSelected
            ? "#1F6349"
            : isHovered
            ? "rgba(31, 99, 73, 0.55)"
            : "rgba(31, 99, 73, 0.35)";
          ctx.lineWidth = isSelected ? 2 : 1.2;
          ctx.stroke();

          // Vector Building Glyph
          ctx.save();
          ctx.strokeStyle = isSelected ? "#1F6349" : "#3E8C6E";
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
          ctx.fillStyle = "#5B8DEF";
          ctx.fill();
          ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = "#FFFFFF";
          ctx.font = "500 8.5px var(--font-sans), Inter, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(node.contactCount), node.x + r * 0.7, node.y - r * 0.7);

          // Node Text Capsule
          if (zoom > 0.45) {
            ctx.font = "400 11px var(--font-sans), Inter, sans-serif";
            const textWidth = ctx.measureText(node.name).width;
            const padX = 5;

            ctx.fillStyle = "#1B1D21";
            ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(node.x - textWidth / 2 - padX, node.y + r + 4, textWidth + padX * 2, 16, 4);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = "#FFFFFF";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(node.name, node.x, node.y + r + 12);
          }
        } else if (node.nodeType === "community") {
          const r = node.radius;
          // Regular hexagon, flat-top, matching Weave's `shapeD` community case.
          const hexPoints: Array<[number, number]> = [];
          for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 2;
            hexPoints.push([node.x + r * Math.cos(angle), node.y + r * Math.sin(angle)]);
          }

          ctx.beginPath();
          hexPoints.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
          ctx.closePath();
          ctx.fillStyle = isSelected
            ? "#D3C2F0"
            : isHovered
            ? "#E4D6F8"
            : "#F1EBFC";
          ctx.fill();

          ctx.strokeStyle = isSelected
            ? "#4E3487"
            : isHovered
            ? "rgba(78, 52, 135, 0.55)"
            : "rgba(78, 52, 135, 0.35)";
          ctx.lineWidth = isSelected ? 2 : 1.2;
          ctx.stroke();

          // Three-circle "community" glyph, matching Weave's icon
          ctx.save();
          ctx.strokeStyle = isSelected ? "#4E3487" : "#7E5FC4";
          ctx.lineWidth = 1.2;
          const g = r * 0.28;
          ctx.beginPath();
          ctx.arc(node.x - g, node.y - g * 0.5, g * 0.7, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(node.x + g, node.y - g * 0.5, g * 0.7, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(node.x, node.y + g * 0.7, g * 0.8, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();

          // Member-count badge
          ctx.beginPath();
          ctx.arc(node.x + r * 0.7, node.y - r * 0.7, 7, 0, Math.PI * 2);
          ctx.fillStyle = "#5B8DEF";
          ctx.fill();
          ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = "#FFFFFF";
          ctx.font = "500 8.5px var(--font-sans), Inter, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(node.contactCount), node.x + r * 0.7, node.y - r * 0.7);

          if (zoom > 0.45) {
            ctx.font = "400 11px var(--font-sans), Inter, sans-serif";
            const textWidth = ctx.measureText(node.name).width;
            const padX = 5;

            ctx.fillStyle = "#1B1D21";
            ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(node.x - textWidth / 2 - padX, node.y + r + 4, textWidth + padX * 2, 16, 4);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = "#FFFFFF";
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
            ? "#1B1D21"
            : isHovered
            ? "#F4F4F1"
            : "#FFFFFF";
          ctx.fill();

          ctx.strokeStyle = isSelected
            ? "#5B8DEF"
            : isHovered
            ? "rgba(27, 29, 33, 0.35)"
            : "rgba(27, 29, 33, 0.18)";
          ctx.lineWidth = isSelected ? 2 : 1.2;
          ctx.stroke();

          // Category dot indicator on node top right
          ctx.beginPath();
          ctx.arc(node.x + r * 0.65, node.y - r * 0.65, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = colors.dot;
          ctx.fill();
          ctx.strokeStyle = isSelected ? "#1B1D21" : "#FFFFFF";
          ctx.lineWidth = 1.2;
          ctx.stroke();

          // Initials
          ctx.fillStyle = isSelected ? "#FFFFFF" : "#1B1D21";
          ctx.font = "500 10px var(--font-sans), Inter, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(initials(node.name), node.x, node.y + 0.5);

          if (zoom > 0.5) {
            ctx.font = "400 11px var(--font-sans), Inter, sans-serif";
            const textWidth = ctx.measureText(node.name).width;
            const padX = 5;

            ctx.fillStyle = "#1B1D21";
            ctx.strokeStyle = isSelected ? "rgba(255, 255, 255, 0.3)" : "rgba(255, 255, 255, 0.1)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(node.x - textWidth / 2 - padX, node.y + r + 4, textWidth + padX * 2, 16, 4);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = "#FFFFFF";
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
                ctx.fillStyle = "#9A9A94";
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
  }, [showParticles, selectedNode, hoveredNode, searchMatchIds]);

  // Pointer events rather than mouse events: they deliver touch and pen through
  // the same path, which is what makes the graph operable on a phone at all —
  // with mouse-only handlers a finger drag never reached the canvas.
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    // Capture keeps a drag alive when the finger leaves the canvas, but it is
    // not worth losing the interaction over: if the pointer isn't capturable,
    // carry on without it rather than aborting the gesture.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* no capture available — dragging still works within the canvas */
    }
    pointersRef.current.set(e.pointerId, { x: clientX, y: clientY });

    // Second finger down: switch from drag to pinch and abandon whatever the
    // first finger had grabbed, so a zoom never drags a node along with it.
    if (pointersRef.current.size === 2) {
      const [a, b] = Array.from(pointersRef.current.values());
      pinchRef.current = { dist: Math.max(1, Math.hypot(a!.x - b!.x, a!.y - b!.y)), zoom: cameraRef.current.zoom };
      dragRef.current.isDragging = false;
      dragRef.current.draggedNode = null;
      dragRef.current.isPanning = false;
      hasManualCameraRef.current = true;
      return;
    }
    if (pointersRef.current.size > 2) return;

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
      hasManualCameraRef.current = true;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    if (pointersRef.current.has(e.pointerId)) pointersRef.current.set(e.pointerId, { x: clientX, y: clientY });

    // Pinch: scale about the midpoint between the two fingers, same
    // anchor-preserving math the wheel handler uses.
    if (pointersRef.current.size === 2 && pinchRef.current) {
      const [a, b] = Array.from(pointersRef.current.values());
      const dist = Math.max(1, Math.hypot(a!.x - b!.x, a!.y - b!.y));
      const midX = (a!.x + b!.x) / 2;
      const midY = (a!.y + b!.y) / 2;
      const newZoom = Math.min(3.5, Math.max(0.25, pinchRef.current.zoom * (dist / pinchRef.current.dist)));
      const worldBefore = screenToWorld(midX, midY);
      cameraRef.current.zoom = newZoom;
      cameraRef.current.x = midX - worldBefore.x * newZoom;
      cameraRef.current.y = midY - worldBefore.y * newZoom;
      targetCameraRef.current = null;
      return;
    }

    // Hover is a mouse-only concept; on touch a "move" only ever arrives
    // mid-drag, and treating it as hover would leave a tooltip stuck on screen.
    if (e.pointerType !== "mouse" && !dragRef.current.isDragging) return;

    if (dragRef.current.isDragging) {
      const dx = clientX - dragRef.current.lastMouseX;
      const dy = clientY - dragRef.current.lastMouseY;
      dragRef.current.lastMouseX = clientX;
      dragRef.current.lastMouseY = clientY;

      if (dragRef.current.draggedNode) {
        const world = screenToWorld(clientX, clientY);
        dragRef.current.draggedNode.x = world.x;
        dragRef.current.draggedNode.y = world.y;
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

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const wasPinching = pointersRef.current.size >= 2;
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* nothing captured */
    }
    // Lifting one finger out of a pinch must not register as a tap.
    if (wasPinching) {
      dragRef.current.isDragging = false;
      dragRef.current.draggedNode = null;
      dragRef.current.isPanning = false;
      return;
    }
    // Touch has no hover state to leave behind, so clear any stale tooltip.
    if (e.pointerType !== "mouse") {
      setHoveredNode(null);
      setTooltipPos(null);
    }

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
      const { id, x, y } = dragRef.current.draggedNode;
      pinnedPositionsRef.current.set(id, { x, y });
    }

    dragRef.current.isDragging = false;
    dragRef.current.draggedNode = null;
    dragRef.current.isPanning = false;
  };

  /** Leaving the canvas with the mouse must clear hover, otherwise the tooltip
   * stays pinned over whatever the cursor moved on to. */
  const handlePointerLeave = () => {
    if (dragRef.current.isDragging) return;
    setHoveredNode(null);
    setTooltipPos(null);
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
    hasManualCameraRef.current = true;
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
    hasManualCameraRef.current = true;
  };

  /** Click (or drag) the mini-map to send the camera there. It already draws a
   * viewport rectangle, which reads as a drag handle — without this it was a
   * control that looked interactive and wasn't. */
  const handleMiniMapPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const proj = miniMapProjRef.current;
    const container = containerRef.current;
    if (!proj || !container) return;
    // Only act on a press or a press-and-drag, never on a bare hover.
    if (e.type === "pointermove" && e.buttons === 0) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const { minX, minY, pad, scale } = proj;
    const worldX = (e.clientX - rect.left) / scale + minX - pad;
    const worldY = (e.clientY - rect.top) / scale + minY - pad;

    const { zoom } = cameraRef.current;
    targetCameraRef.current = {
      x: container.clientWidth / 2 - worldX * zoom,
      y: container.clientHeight / 2 - worldY * zoom,
      zoom,
    };
    hasManualCameraRef.current = true;
  };

  // Explicit re-center: an intentional "go back to fit-to-content," so a
  // later resize is allowed to auto-fit again too.
  const handleRecenter = () => {
    hasManualCameraRef.current = false;
    fitToScreen();
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    setTimeout(fitToScreen, 150);
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden rounded-xl border border-border graph-canvas-bg transition-all duration-200 ${
        isFullscreen ? "fixed inset-0 z-50 h-screen rounded-none" : "h-[70vh] max-h-[700px] min-h-[420px]"
      }`}
    >
      {/* touch-none hands every gesture to the handlers below; without it the
          browser scrolls the page instead and the graph can't be panned. */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        className="block size-full touch-none cursor-grab active:cursor-grabbing"
      />

      {/* TOP HEADER CONTROLS BAR */}
      <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-1.5">
        <div className="relative w-52 sm:w-60 max-w-[calc(100vw-8rem)]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("graph.searchPlaceholder")}
            className="pl-8 pr-3 h-7 bg-card/90 border-border text-xs text-foreground placeholder:text-muted-foreground rounded-md focus:border-accent"
          />
        </div>

        <div className="hidden lg:flex items-center gap-1">
          {(
            [
              { type: "contact" as const, color: "#EF8163", label: t("graph.type.contact") },
              { type: "company" as const, color: "#43A883", label: t("graph.type.company") },
              { type: "community" as const, color: "#9B7BE0", label: t("graph.type.community") },
            ] as const
          ).map(({ type, color, label }) => {
            const isOn = !hiddenTypes[type];
            return (
              <button
                key={type}
                onClick={() => setHiddenTypes((prev) => ({ ...prev, [type]: !prev[type] }))}
                className="flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors"
                style={
                  isOn
                    ? { backgroundColor: `${color}1A`, borderColor: color, color }
                    : { backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--muted-foreground)" }
                }
              >
                <span className="size-1.5 rounded-full" style={{ backgroundColor: isOn ? color : "var(--muted-foreground)" }} />
                {label}
              </button>
            );
          })}
        </div>

        <div className="hidden lg:flex items-center gap-0.5 bg-card/90 p-0.5 rounded-md border border-border">
          <button
            onClick={() => setSelectedCategory("ALL")}
            className={`px-2 py-0.5 text-[11px] font-normal rounded transition-colors ${
              selectedCategory === "ALL"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("graph.all")} ({graphData.stats.totalContacts})
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
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: CATEGORY_COLORS[cat].dot }}
                />
                {t(`category.${cat}`)}
                <span className="text-[10px] text-muted-foreground font-mono">{count}</span>
              </button>
            );
          })}
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowControlsMenu(!showControlsMenu)}
          className="h-7 px-2 bg-card/90 border-border text-muted-foreground hover:text-foreground rounded-md text-xs gap-1.5"
        >
          <Sliders className="size-3" />
          <span>{t("graph.filters")}</span>
        </Button>
      </div>

      {/* FLOATING FILTER & PHYSICS POPUP */}
      {showControlsMenu && (
        <div className="absolute top-12 left-3 z-30 w-60 rounded-lg border border-border bg-card/95 p-3 shadow-xl backdrop-blur-xl text-xs space-y-2.5">
          <div className="flex items-center justify-between border-b border-border pb-1.5">
            <span className="font-medium text-foreground flex items-center gap-1.5 text-xs">
              <Sliders className="size-3 text-muted-foreground" />
              {t("graph.parameters")}
            </span>
            <button
              onClick={() => setShowControlsMenu(false)}
              aria-label={t("graph.closeFilters")}
              className="-mr-1 flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              ✕
            </button>
          </div>

          {/* Below lg the type and category rows are hidden from the toolbar for
              want of width, so they live here instead — otherwise the two main
              filters of the graph simply don't exist on a phone. */}
          <div className="space-y-2 border-b border-border pb-2.5 lg:hidden">
            <div className="text-[11px] text-muted-foreground">{t("graph.typesLabel")}</div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { type: "contact" as const, color: "#EF8163", label: t("graph.type.contact") },
                  { type: "company" as const, color: "#43A883", label: t("graph.type.company") },
                  { type: "community" as const, color: "#9B7BE0", label: t("graph.type.community") },
                ] as const
              ).map(({ type, color, label }) => {
                const isOn = !hiddenTypes[type];
                return (
                  <button
                    key={type}
                    onClick={() => setHiddenTypes((prev) => ({ ...prev, [type]: !prev[type] }))}
                    aria-pressed={isOn}
                    className="flex h-9 items-center gap-1.5 rounded-full border px-3 text-[11px] font-medium transition-colors"
                    style={
                      isOn
                        ? { backgroundColor: `${color}1A`, borderColor: color, color }
                        : { backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--muted-foreground)" }
                    }
                  >
                    <span className="size-1.5 rounded-full" style={{ backgroundColor: isOn ? color : "var(--muted-foreground)" }} />
                    {label}
                  </button>
                );
              })}
            </div>

            {components.length > 1 && (
              <>
                <div className="text-[11px] text-muted-foreground">{t("graph.clusters")}</div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setSelectedComponentIndex(null)}
                    aria-pressed={selectedComponentIndex === null}
                    className={`h-9 rounded-full px-3 text-[11px] font-semibold ${
                      selectedComponentIndex === null ? "bg-primary text-primary-foreground" : "border border-border text-foreground"
                    }`}
                  >
                    {t("graph.clusters.all")}
                  </button>
                  {components.map((c) => (
                    <button
                      key={c.index}
                      onClick={() => setSelectedComponentIndex(c.index)}
                      aria-pressed={selectedComponentIndex === c.index}
                      className={`flex h-9 items-center gap-1 rounded-full px-3 text-[11px] font-semibold ${
                        selectedComponentIndex === c.index ? "bg-primary text-primary-foreground" : "border border-border text-foreground"
                      }`}
                    >
                      C{c.index + 1}
                      <span className="font-mono text-[9.5px] opacity-65">{c.size}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            <button
              onClick={() => setCollapseLeaf((v) => !v)}
              aria-pressed={collapseLeaf}
              className="flex h-9 w-full items-center gap-2 rounded-md border border-border px-2.5 text-[11.5px] font-semibold text-muted-foreground"
            >
              <span className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${collapseLeaf ? "bg-primary" : "bg-secondary"}`}>
                <span
                  className={`absolute top-0.5 size-3 rounded-full bg-card transition-transform ${collapseLeaf ? "translate-x-3.5" : "translate-x-0.5"}`}
                />
              </span>
              {t("graph.collapseLeaf")}
            </button>

            <div className="text-[11px] text-muted-foreground">{t("graph.categoriesLabel")}</div>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setSelectedCategory("ALL")}
                aria-pressed={selectedCategory === "ALL"}
                className={`h-9 rounded px-2.5 text-[11px] transition-colors ${
                  selectedCategory === "ALL" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("graph.all")} ({graphData.stats.totalContacts})
              </button>
              {(["VIP", "INVESTOR", "LEAD", "COLLEAGUE", "FRIEND", "HR"] as ContactCategory[]).map((cat) => {
                const count = graphData.stats.categoryCounts[cat] || 0;
                if (count === 0) return null;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    aria-pressed={selectedCategory === cat}
                    className={`h-9 rounded px-2.5 text-[11px] transition-colors ${
                      selectedCategory === cat ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t(`category.${cat}`)} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-muted-foreground text-[11px]">
              <span>{t("graph.minScore")}</span>
              <span className="font-mono text-foreground">{minScore} / 10</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-full accent-primary h-1 bg-secondary rounded"
            />
          </div>

          <div className="flex items-center justify-between py-0.5">
            <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <Zap className="size-3 text-muted-foreground" />
              {t("graph.animation")}
            </span>
            <button
              onClick={() => setShowParticles(!showParticles)}
              className={`relative inline-flex h-3.5 w-6.5 shrink-0 cursor-pointer rounded-full transition-colors ${
                showParticles ? "bg-accent" : "bg-secondary"
              }`}
            >
              <span
                className={`inline-block size-2.5 rounded-full bg-card ${
                  showParticles ? "translate-x-3 translate-y-0.5" : "translate-x-0.5 translate-y-0.5"
                } transition-transform`}
              />
            </button>
          </div>
        </div>
      )}

      {/* TOP RIGHT STATS HUD BAR */}
      <div className="absolute top-3 right-3 z-20 hidden md:flex items-center gap-2 bg-card/90 px-2.5 py-1 rounded-md border border-border text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span className="size-1.5 rounded-full bg-accent" />
          <span className="text-foreground font-medium tabular-nums">{filteredNodes.length}</span>
          <span className="text-muted-foreground">{t("graph.nodesUnit")}</span>
        </div>
        <span className="text-border">•</span>
        <div className="flex items-center gap-1 text-muted-foreground">
          <span className="text-foreground font-medium tabular-nums">{filteredLinks.length}</span>
          <span className="text-muted-foreground">{t("graph.linksUnit")}</span>
        </div>
        <span className="text-border">•</span>
        <button
          onClick={refreshGraph}
          disabled={isRefreshing}
          className="text-muted-foreground hover:text-foreground p-0.5 transition-colors"
          title={t("graph.refresh")}
        >
          <RefreshCw className={`size-3 ${isRefreshing ? "animate-spin text-accent" : ""}`} />
        </button>
      </div>

      {/* TOP LEFT STACKED CONTROLS — zoom/fit, disconnected clusters, collapse-leaf */}
      <div className="absolute top-14 left-3 z-20 flex flex-col items-start gap-2">
        <div className="flex items-center gap-0.5 bg-card/90 p-0.5 rounded-md border border-border">
          <button
            onClick={() => handleZoom("out")}
            className="flex size-6 items-center justify-center rounded text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            title={t("graph.zoomOut")}
          >
            −
          </button>
          <span className="w-10 text-center font-mono text-[10.5px] text-muted-foreground">{zoomDisplay}%</span>
          <button
            onClick={() => handleZoom("in")}
            className="flex size-6 items-center justify-center rounded text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            title={t("graph.zoomIn")}
          >
            +
          </button>
          <button
            onClick={handleRecenter}
            className="rounded px-2 h-6 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {t("graph.fit")}
          </button>
          <div className="h-3 w-px bg-border mx-0.5" />
          <button
            onClick={toggleFullscreen}
            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            title={t("graph.fullscreen")}
          >
            {isFullscreen ? <Minimize2 className="size-3" /> : <Maximize2 className="size-3" />}
          </button>
        </div>

        {components.length > 1 && (
          <div className="hidden max-w-[330px] flex-wrap items-center gap-1.5 rounded-md border border-border bg-card/90 p-1.5 lg:flex">
            <span className="w-full font-mono text-[8.5px] uppercase tracking-wide text-muted-foreground">
              {t("graph.clusters")}
            </span>
            <button
              onClick={() => setSelectedComponentIndex(null)}
              className={`flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                selectedComponentIndex === null ? "bg-primary text-primary-foreground" : "border border-border text-foreground"
              }`}
            >
              {t("graph.clusters.all")}
            </button>
            {components.map((c) => (
              <button
                key={c.index}
                onClick={() => setSelectedComponentIndex(c.index)}
                className={`flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  selectedComponentIndex === c.index ? "bg-primary text-primary-foreground" : "border border-border text-foreground"
                }`}
              >
                C{c.index + 1}
                <span className="font-mono text-[9.5px] opacity-65">{c.size}</span>
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => setCollapseLeaf((v) => !v)}
          aria-pressed={collapseLeaf}
          className="hidden items-center gap-1.5 rounded-md border border-border bg-card/90 px-2.5 py-1.5 text-[11.5px] font-semibold text-muted-foreground lg:flex"
        >
          <span className={`relative h-3.5 w-6.5 shrink-0 rounded-full transition-colors ${collapseLeaf ? "bg-primary" : "bg-secondary"}`}>
            <span
              className={`absolute top-0.5 size-2.5 rounded-full bg-card transition-transform ${
                collapseLeaf ? "translate-x-3.5" : "translate-x-0.5"
              }`}
            />
          </span>
          {t("graph.collapseLeaf")}
        </button>

        {focusNodeId ? (
          <div className="flex items-center gap-2 rounded-md bg-primary px-2.5 py-1.5 text-[11.5px] font-semibold text-primary-foreground">
            {t("graph.focused")}: {graphData.nodes.find((n) => n.id === focusNodeId)?.name ?? ""}
            <button onClick={() => setFocusNodeId(null)} className="opacity-70 hover:opacity-100">
              <X className="size-3" />
            </button>
          </div>
        ) : selectedComponentIndex !== null && (
          <div className="flex items-center gap-2 rounded-md bg-primary px-2.5 py-1.5 text-[11.5px] font-semibold text-primary-foreground">
            {t("graph.focused")}: C{selectedComponentIndex + 1}
            <button onClick={() => setSelectedComponentIndex(null)} className="opacity-70 hover:opacity-100">
              <X className="size-3" />
            </button>
          </div>
        )}
      </div>

      {/* BOTTOM RIGHT — node-spec legend, stacked above the mini-map */}
      <div className="absolute bottom-[86px] right-3 z-20 hidden sm:flex w-38 flex-col gap-1.5 rounded-md border border-border bg-card/95 p-2.5">
        <span className="font-mono text-[8.5px] uppercase tracking-wide text-muted-foreground">{t("graph.nodeSpec")}</span>
        <div className="flex items-center gap-1.5 text-[10px] text-foreground">
          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: "#EF8163" }} />
          {t("graph.nodeSpec.contact")}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-foreground">
          <span className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: "#43A883" }} />
          {t("graph.nodeSpec.company")}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-foreground">
          <span
            className="size-2.5 shrink-0"
            style={{ backgroundColor: "#9B7BE0", clipPath: "polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)" }}
          />
          {t("graph.nodeSpec.community")}
        </div>
        <div className="h-px bg-border" />
        <p className="whitespace-pre-line text-[9.5px] leading-relaxed text-muted-foreground">{t("graph.nodeSpec.caption")}</p>
      </div>

      {/* BOTTOM RIGHT MINI-MAP NAVIGATOR */}
      <div className="absolute bottom-3 right-3 z-20 hidden sm:block rounded-md border border-border bg-card/95 p-1 shadow-sm">
        <canvas
          ref={miniMapCanvasRef}
          width={100}
          height={65}
          onPointerDown={handleMiniMapPointer}
          onPointerMove={handleMiniMapPointer}
          title={t("graph.minimapHint")}
          aria-label={t("graph.minimapHint")}
          className="block cursor-crosshair rounded bg-muted touch-none"
        />
      </div>

      {/* HOVER TOOLTIP */}
      {hoveredNode && tooltipPos && !selectedNode && (
        <div
          className="pointer-events-none fixed z-40 w-52 rounded-lg border border-border bg-card/98 p-2.5 text-xs text-foreground shadow-xl transition-opacity duration-150"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
          }}
        >
          {hoveredNode.nodeType === "contact" ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground truncate">{hoveredNode.name}</span>
                <span className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.2 text-[10px] text-secondary-foreground">
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[hoveredNode.category].dot }}
                  />
                  {t(`category.${hoveredNode.category}`)}
                </span>
              </div>
              {hoveredNode.role && (
                <p className="text-muted-foreground text-[11px]">{hoveredNode.role}</p>
              )}
              {hoveredNode.companyName && (
                <p className="text-muted-foreground text-[11px]">{hoveredNode.companyName}</p>
              )}
              {hoveredNode.usefulnessScore != null && (
                <p className="text-muted-foreground text-[11px] font-mono">
                  ★ {hoveredNode.usefulnessScore} / 10
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-0.5">
              <div className="font-medium text-foreground">{hoveredNode.name}</div>
              <p className="text-muted-foreground text-[11px]">
                {`${hoveredNode.contactCount} ${
                  hoveredNode.nodeType === "community" ? t("graph.membersUnit") : t("graph.contactsUnit")
                }`}
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
          onFocus={(id) => setFocusNodeId(id)}
        />
      )}
    </div>
  );
}
