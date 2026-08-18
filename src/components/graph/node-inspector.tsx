"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { uk, enUS } from "date-fns/locale";
import {
  X,
  Building2,
  UsersRound,
  ExternalLink,
  Plus,
  Loader2,
  Users,
  Compass,
  MessageSquare,
  ArrowRight,
  GitBranch,
  Crosshair,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CATEGORY_COLORS, initials } from "@/lib/contact-display";
import type { GraphNode, GraphContactNode, GraphCompanyNode, GraphCommunityNode, GraphLink } from "@/lib/data/graph";
import type { ClusterDiagramData } from "@/lib/data/cluster";
import { AddConnectionDialog } from "@/components/graph/add-connection-dialog";
import { ClusterWorkflowDiagram } from "@/components/timeline/cluster-workflow-diagram";
import { BranchParentPicker } from "@/components/timeline/branch-parent-picker";
import { useTranslation } from "@/lib/i18n/context";

interface NodeInspectorProps {
  node: GraphNode | null;
  allNodes: GraphNode[];
  links: GraphLink[];
  onClose: () => void;
  onRefreshGraph: () => void;
  onFocus: (nodeId: string) => void;
}

interface InspectorEvent {
  id: string;
  type: string;
  rawText: string;
  createdAt: string;
}

function nodeIconBadge(node: GraphNode) {
  if (node.nodeType === "contact") {
    const colors = CATEGORY_COLORS[node.category];
    return (
      <Avatar className="size-9 border border-border shrink-0" style={{ backgroundColor: colors.bg }}>
        <AvatarFallback className="font-medium text-xs" style={{ backgroundColor: colors.bg, color: colors.text }}>
          {initials(node.name)}
        </AvatarFallback>
      </Avatar>
    );
  }
  if (node.nodeType === "company") {
    return (
      <div className="flex size-9 items-center justify-center rounded-lg border border-border shrink-0" style={{ backgroundColor: "#E8F6F0" }}>
        <Building2 className="size-4" style={{ color: "#1F6349" }} />
      </div>
    );
  }
  return (
    <div className="flex size-9 items-center justify-center rounded-lg border border-border shrink-0" style={{ backgroundColor: "#F1EBFC" }}>
      <UsersRound className="size-4" style={{ color: "#4E3487" }} />
    </div>
  );
}

export function NodeInspector({ node, allNodes, links, onClose, onRefreshGraph, onFocus }: NodeInspectorProps) {
  const [quickNote, setQuickNote] = useState("");
  const [noteParentId, setNoteParentId] = useState<string | null>(null);
  const [isSubmittingNote, startNoteTransition] = useTransition();
  const [isConnectDialogOpen, setIsConnectDialogOpen] = useState(false);
  const [events, setEvents] = useState<InspectorEvent[] | null>(null);
  const [loadedContactId, setLoadedContactId] = useState<string | null>(null);
  const [workflowEntityKey, setWorkflowEntityKey] = useState<string | null>(null);

  const { t, locale } = useTranslation();
  const dateLocale = locale === "uk" ? uk : enUS;

  const isContact = node?.nodeType === "contact";
  const contactNode = isContact ? (node as GraphContactNode) : null;
  const companyNode = node?.nodeType === "company" ? (node as GraphCompanyNode) : null;
  const communityNode = node?.nodeType === "community" ? (node as GraphCommunityNode) : null;
  const contactId = contactNode?.id ?? null;

  // Fetch this contact's own logged events for the Interactions section — the
  // graph-driven entry point into the big workflow diagram: click a node,
  // then one of its events. Company/community nodes have no direct
  // interaction log of their own (Interaction only ever attaches to a
  // Contact or a ContactConnection), so this stays contact-only. Loading
  // state is derived (`loadedContactId !== contactId`) rather than a
  // separate flag toggled synchronously in the effect body.
  useEffect(() => {
    if (!contactId) return;
    let cancelled = false;
    fetch(`/api/timeline/cluster?entityKey=contact:${contactId}`)
      .then((res) => (res.ok ? (res.json() as Promise<ClusterDiagramData>) : Promise.reject()))
      .then((data) => {
        if (cancelled) return;
        // Branches render as subordinate detail inside the full diagram only —
        // this compact preview stays main-line-only to avoid clutter.
        const own = data.events
          .filter((e) => e.entity.kind === "contact" && e.entity.contact.id === contactId && !e.parentInteractionId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 8);
        setEvents(own);
        setLoadedContactId(contactId);
      })
      .catch(() => {
        if (cancelled) return;
        setEvents([]);
        setLoadedContactId(contactId);
      });
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  const eventsLoading = Boolean(contactId) && loadedContactId !== contactId;

  if (!node) return null;

  const connectedLinks = links.filter((l) => l.source === node.id || l.target === node.id);
  const connectedNeighbors = connectedLinks
    .map((link) => {
      const targetId = link.source === node.id ? link.target : link.source;
      return { link, neighbor: allNodes.find((n) => n.id === targetId) };
    })
    .filter((item) => Boolean(item.neighbor));

  const handleAddNote = () => {
    if (!contactNode || !quickNote.trim()) return;

    startNoteTransition(async () => {
      try {
        const res = await fetch("/api/process-interaction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rawText: quickNote.trim(),
            contactId: contactNode.id,
            type: "NOTE",
            parentInteractionId: noteParentId,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error ?? t("inspector.noteSaveError"));
        }

        toast.success(t("inspector.noteSaved"));
        setQuickNote("");
        setNoteParentId(null);
        onRefreshGraph();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("inspector.noteSaveError"));
      }
    });
  };

  const candidateContacts = allNodes
    .filter((n): n is GraphContactNode => n.nodeType === "contact" && n.id !== node.id)
    .map((c) => ({
      id: c.id,
      fullName: c.name,
      role: c.role,
      companyName: c.companyName,
    }));

  const subtitle = contactNode
    ? [contactNode.role, contactNode.companyName].filter(Boolean).join(" · ")
    : companyNode
    ? companyNode.industry ?? t("inspector.company")
    : communityNode
    ? `${communityNode.contactCount} ${t("graph.membersUnit")}`
    : "";

  return (
    <>
      <div className="absolute inset-x-3 top-3 z-30 max-h-[calc(100%-1.5rem)] sm:inset-x-auto sm:right-3 sm:w-84 flex flex-col rounded-xl border border-border bg-card text-foreground shadow-2xl backdrop-blur-xl transition-all duration-150 overflow-hidden">
        {/* Header */}
        <div className="flex items-start gap-2.5 border-b border-border px-3.5 py-3 bg-card">
          {nodeIconBadge(node)}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium tracking-wide uppercase text-muted-foreground">
                {isContact ? t("inspector.contact") : companyNode ? t("inspector.company") : t("inspector.community")}
              </span>
            </div>
            <h3 className="text-[13.5px] font-semibold text-foreground truncate tracking-tight leading-tight mt-0.5">{node.name}</h3>
            {subtitle && <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground shrink-0"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {/* Open card / Focus */}
        <div className="flex gap-1.5 px-3.5 pt-2.5">
          {isContact && contactNode && (
            <Link
              href={`/contacts/${contactNode.id}`}
              className="flex-1 rounded-md bg-primary text-primary-foreground text-[11.5px] font-semibold h-7 flex items-center justify-center gap-1.5"
            >
              <ExternalLink className="size-3" />
              {t("inspector.openCard")}
            </Link>
          )}
          <button
            onClick={() => onFocus(node.id)}
            className={`rounded-md border border-border text-[11.5px] font-semibold h-7 flex items-center justify-center gap-1.5 ${
              isContact ? "flex-1" : "flex-1"
            } text-foreground hover:bg-muted transition-colors`}
          >
            <Crosshair className="size-3" />
            {t("inspector.focus")}
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3.5 text-xs">
          {/* Stat boxes */}
          <div className={`grid gap-2 ${isContact ? "grid-cols-2" : "grid-cols-1"}`}>
            <div className="rounded-lg border border-border bg-muted px-2.5 py-2">
              <div className="text-[10px] text-muted-foreground">{t("inspector.linksStat")}</div>
              <div className="text-base font-semibold text-foreground mt-0.5">{connectedNeighbors.length}</div>
            </div>
            {isContact && (
              <div className="rounded-lg border border-border bg-muted px-2.5 py-2">
                <div className="text-[10px] text-muted-foreground">{t("inspector.interactionsStat")}</div>
                <div className="text-base font-semibold text-foreground mt-0.5">
                  {eventsLoading ? <Loader2 className="size-3 animate-spin" /> : events?.length ?? 0}
                </div>
              </div>
            )}
          </div>

          {/* Fields */}
          <div className="space-y-1.5">
            <span className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              {t("inspector.fields")}
            </span>
            <div className="flex flex-col gap-px overflow-hidden rounded-lg border border-border bg-border">
              {contactNode && (
                <>
                  {contactNode.role && <FieldRow label={t("contact.form.role")} value={contactNode.role} />}
                  {contactNode.companyName && <FieldRow label={t("contact.form.company")} value={contactNode.companyName} />}
                  {contactNode.usefulnessScore != null && (
                    <FieldRow label={t("contact.valueScore")} value={`${contactNode.usefulnessScore}/10`} />
                  )}
                </>
              )}
              {companyNode && (
                <>
                  {companyNode.industry && <FieldRow label={t("inspector.field.industry")} value={companyNode.industry} />}
                  {companyNode.description && <FieldRow label={t("inspector.field.description")} value={companyNode.description} />}
                  <FieldRow label={t("company.table.contacts")} value={String(companyNode.contactCount)} />
                </>
              )}
              {communityNode && (
                <>
                  {communityNode.description && <FieldRow label={t("inspector.field.description")} value={communityNode.description} />}
                  <FieldRow label={t("inspector.field.members")} value={String(communityNode.contactCount)} />
                </>
              )}
            </div>
          </div>

          {/* Context & Notes (contact only) */}
          {isContact && contactNode && (
            <div className="space-y-1.5 rounded-lg border border-border bg-muted p-2.5 text-xs">
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                <Compass className="size-3 text-muted-foreground" />
                {t("inspector.context")}
              </div>

              {contactNode.temperament && (
                <div className="text-[11px]">
                  <span className="text-muted-foreground">{t("inspector.style")} </span>
                  <span className="text-foreground">{contactNode.temperament}</span>
                </div>
              )}

              {contactNode.needs && (
                <div className="text-[11px]">
                  <span className="text-muted-foreground">{t("inspector.needs")} </span>
                  <span className="text-foreground">{contactNode.needs}</span>
                </div>
              )}

              {contactNode.valuePotential && (
                <div className="text-[11px]">
                  <span className="text-muted-foreground">{t("inspector.potential")} </span>
                  <span className="text-foreground">{contactNode.valuePotential}</span>
                </div>
              )}

              {contactNode.fullSummary && (
                <div className="pt-1.5 border-t border-border text-[11px] text-muted-foreground leading-relaxed">
                  <p className="line-clamp-3">{contactNode.fullSummary}</p>
                </div>
              )}
            </div>
          )}

          {/* Connections */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                <Users className="size-3 text-muted-foreground" />
                {t("inspector.connections")} ({connectedNeighbors.length})
              </span>
              {isContact && contactNode && (
                <button
                  onClick={() => setIsConnectDialogOpen(true)}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus className="size-3" />
                  {t("graph.add")}
                </button>
              )}
            </div>

            {connectedNeighbors.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-2 text-center text-[11px] text-muted-foreground">
                {t("inspector.noConnections")}
              </div>
            ) : (
              <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5">
                {connectedNeighbors.map(({ link, neighbor }) => {
                  if (!neighbor) return null;
                  const isNeighborContact = neighbor.nodeType === "contact";
                  const neighborContact = isNeighborContact ? (neighbor as GraphContactNode) : null;

                  return (
                    <div
                      key={link.id}
                      className="flex items-center justify-between rounded-md border border-border bg-muted p-1.5 text-xs hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isNeighborContact && neighborContact ? (
                          <Avatar className="size-5 shrink-0 bg-secondary">
                            <AvatarFallback className="text-[9px] bg-secondary text-secondary-foreground">
                              {initials(neighborContact.name)}
                            </AvatarFallback>
                          </Avatar>
                        ) : neighbor.nodeType === "company" ? (
                          <div className="flex size-5 shrink-0 items-center justify-center rounded" style={{ backgroundColor: "#E8F6F0" }}>
                            <Building2 className="size-2.5" style={{ color: "#1F6349" }} />
                          </div>
                        ) : (
                          <div className="flex size-5 shrink-0 items-center justify-center rounded" style={{ backgroundColor: "#F1EBFC" }}>
                            <UsersRound className="size-2.5" style={{ color: "#4E3487" }} />
                          </div>
                        )}

                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate text-[11px]">{neighbor.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {link.relationship || (isNeighborContact ? t("contact.defaultRelationship") : t("inspector.organization"))}
                          </p>
                        </div>
                      </div>

                      {isNeighborContact && (
                        <Link
                          href={`/contacts/${neighbor.id}`}
                          className="text-muted-foreground hover:text-foreground p-0.5"
                        >
                          <ExternalLink className="size-3" />
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Interactions — the entry point into the full workflow diagram */}
          {isContact && contactNode && (
            <div className="space-y-1.5">
              <span className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                <GitBranch className="size-3 text-muted-foreground" />
                {t("inspector.interactionsSection")}
              </span>

              {eventsLoading ? (
                <div className="flex items-center justify-center p-3 text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                </div>
              ) : !events || events.length === 0 ? (
                <div className="rounded-md border border-dashed border-border p-2 text-center text-[11px] text-muted-foreground">
                  {t("inspector.noInteractions")}
                </div>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5">
                  {events.map((event) => (
                    <button
                      key={event.id}
                      onClick={() => setWorkflowEntityKey(`contact:${contactNode.id}`)}
                      title={t("inspector.openWorkflow")}
                      className="flex w-full items-center gap-2 rounded-md border border-border bg-muted p-1.5 text-left hover:bg-secondary transition-colors"
                    >
                      <span className="shrink-0 rounded bg-secondary px-1 py-0.5 text-[9.5px] font-mono text-secondary-foreground">
                        {format(new Date(event.createdAt), "d MMM", { locale: dateLocale })}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[11px] text-foreground">{event.rawText}</span>
                      <GitBranch className="size-3 shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quick Note */}
          {isContact && contactNode && (
            <div className="space-y-1.5 pt-1.5 border-t border-border">
              <span className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                <MessageSquare className="size-3 text-muted-foreground" />
                {t("inspector.newEntry")}
              </span>
              <div className="space-y-1.5">
                <Textarea
                  value={quickNote}
                  onChange={(e) => setQuickNote(e.target.value)}
                  placeholder={t("inspector.notePlaceholder")}
                  className="min-h-12 resize-none bg-muted border-border text-base md:text-xs rounded-md"
                  disabled={isSubmittingNote}
                />
                <BranchParentPicker value={noteParentId} onChange={setNoteParentId} className="w-full" />
                <Button
                  size="sm"
                  onClick={handleAddNote}
                  disabled={isSubmittingNote || !quickNote.trim()}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-6.5 text-xs font-medium gap-1"
                >
                  {isSubmittingNote ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <ArrowRight className="size-3" />
                  )}
                  {isSubmittingNote ? t("inspector.saving") : t("inspector.save")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Connection Dialog */}
      {isContact && contactNode && (
        <AddConnectionDialog
          open={isConnectDialogOpen}
          onOpenChange={setIsConnectDialogOpen}
          fromContact={{ id: contactNode.id, name: contactNode.name }}
          availableContacts={candidateContacts}
          onSuccess={() => {
            onRefreshGraph();
          }}
        />
      )}

      <ClusterWorkflowDiagram
        open={workflowEntityKey != null}
        onOpenChange={(open) => !open && setWorkflowEntityKey(null)}
        entityKey={workflowEntityKey}
      />
    </>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  if (!label) return null;
  return (
    <div className="flex gap-2 bg-card px-2.5 py-1.5">
      <span className="w-20 shrink-0 text-[10.5px] text-muted-foreground">{label}</span>
      <span className="text-[11px] font-medium text-foreground truncate">{value}</span>
    </div>
  );
}
