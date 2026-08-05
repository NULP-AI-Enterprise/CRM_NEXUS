"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  X,
  Building2,
  ExternalLink,
  Plus,
  Loader2,
  Users,
  Compass,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CATEGORY_COLORS, initials } from "@/lib/contact-display";
import type { GraphNode, GraphContactNode, GraphCompanyNode, GraphLink } from "@/lib/data/graph";
import { AddConnectionDialog } from "@/components/graph/add-connection-dialog";
import { useTranslation } from "@/lib/i18n/context";

interface NodeInspectorProps {
  node: GraphNode | null;
  allNodes: GraphNode[];
  links: GraphLink[];
  onClose: () => void;
  onRefreshGraph: () => void;
}

export function NodeInspector({
  node,
  allNodes,
  links,
  onClose,
  onRefreshGraph,
}: NodeInspectorProps) {
  const [quickNote, setQuickNote] = useState("");
  const [isSubmittingNote, startNoteTransition] = useTransition();
  const [isConnectDialogOpen, setIsConnectDialogOpen] = useState(false);

  const { t } = useTranslation();

  if (!node) return null;

  const isContact = node.nodeType === "contact";
  const contactNode = isContact ? (node as GraphContactNode) : null;
  const companyNode = !isContact ? (node as GraphCompanyNode) : null;

  const connectedLinks = links.filter(
    (l) => l.source === node.id || l.target === node.id
  );

  const connectedNeighbors = connectedLinks
    .map((link) => {
      const targetId = link.source === node.id ? link.target : link.source;
      const neighborNode = allNodes.find((n) => n.id === targetId);
      return {
        link,
        neighbor: neighborNode,
      };
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
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error ?? t("inspector.noteSaveError"));
        }

        toast.success(t("inspector.noteSaved"));
        setQuickNote("");
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

  return (
    <>
      <div className="absolute top-3 right-3 z-30 w-84 max-w-[calc(100vw-2rem)] max-h-[calc(100%-1.5rem)] flex flex-col rounded-xl border border-white/[0.08] bg-zinc-900/98 text-zinc-100 shadow-2xl backdrop-blur-xl transition-all duration-150 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-3.5 py-2.5 bg-zinc-900">
          <div className="flex items-center gap-2">
            {isContact ? (
              <span className="size-1.5 rounded-full bg-zinc-400" />
            ) : (
              <Building2 className="size-3 text-zinc-400" />
            )}
            <span className="text-[11px] font-medium tracking-wide uppercase text-zinc-400">
              {isContact ? t("inspector.contact") : t("inspector.company")}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded p-0.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3.5 text-xs">
          {/* Main Info */}
          {isContact && contactNode && (
            <div>
              <div className="flex items-start gap-2.5">
                <Avatar className="size-9 border border-white/[0.08] shrink-0 bg-zinc-800">
                  <AvatarFallback className="font-medium text-xs bg-zinc-800 text-zinc-300">
                    {initials(contactNode.name)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-semibold text-white truncate tracking-tight">
                    {contactNode.name}
                  </h3>
                  {contactNode.role && (
                    <p className="text-[11px] text-zinc-400 truncate">{contactNode.role}</p>
                  )}
                  {contactNode.companyName && (
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-zinc-300 truncate">
                      <Building2 className="size-2.5 shrink-0 text-zinc-500" />
                      <span className="truncate">{contactNode.companyName}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Badges Row */}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-zinc-950 px-2 py-0.5 text-[10px] text-zinc-300">
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[contactNode.category].dot }}
                  />
                  {t(`category.${contactNode.category}`)}
                </span>

                {contactNode.usefulnessScore != null && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-zinc-950 px-2 py-0.5 text-[10px] font-mono text-zinc-300">
                    ★ {contactNode.usefulnessScore}/10
                  </span>
                )}

                <span className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-zinc-950 px-2 py-0.5 text-[10px] text-zinc-400">
                  {`${connectedNeighbors.length} ${t("inspector.connectionsCount")}`}
                </span>
              </div>
            </div>
          )}

          {!isContact && companyNode && (
            <div>
              <div className="flex items-start gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-lg bg-zinc-800 border border-white/[0.06] text-zinc-300 shrink-0">
                  <Building2 className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-semibold text-white truncate tracking-tight">
                    {companyNode.name}
                  </h3>
                  {companyNode.industry && (
                    <p className="text-[11px] text-zinc-400">{companyNode.industry}</p>
                  )}
                  <p className="text-[10px] text-zinc-500 mt-0.5 font-mono">
                    {`${companyNode.contactCount} ${t("graph.contactsUnit")}`}
                  </p>
                </div>
              </div>
              {companyNode.description && (
                <p className="mt-2.5 text-xs text-zinc-400 leading-relaxed bg-zinc-950/60 p-2.5 rounded-lg border border-white/[0.06]">
                  {companyNode.description}
                </p>
              )}
            </div>
          )}

          {/* Context & Notes */}
          {isContact && contactNode && (
            <div className="space-y-1.5 rounded-lg border border-white/[0.06] bg-zinc-950/50 p-2.5 text-xs">
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                <Compass className="size-3 text-zinc-500" />
                {t("inspector.context")}
              </div>

              {contactNode.temperament && (
                <div className="text-[11px]">
                  <span className="text-zinc-500">{t("inspector.style")} </span>
                  <span className="text-zinc-300">{contactNode.temperament}</span>
                </div>
              )}

              {contactNode.needs && (
                <div className="text-[11px]">
                  <span className="text-zinc-500">{t("inspector.needs")} </span>
                  <span className="text-zinc-300">{contactNode.needs}</span>
                </div>
              )}

              {contactNode.valuePotential && (
                <div className="text-[11px]">
                  <span className="text-zinc-500">{t("inspector.potential")} </span>
                  <span className="text-zinc-300">{contactNode.valuePotential}</span>
                </div>
              )}

              {contactNode.fullSummary && (
                <div className="pt-1.5 border-t border-white/[0.04] text-[11px] text-zinc-400 leading-relaxed">
                  <p className="line-clamp-3">{contactNode.fullSummary}</p>
                </div>
              )}
            </div>
          )}

          {/* Connected Network Links */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                <Users className="size-3 text-zinc-500" />
                {t("inspector.connections")} ({connectedNeighbors.length})
              </span>
              {isContact && contactNode && (
                <button
                  onClick={() => setIsConnectDialogOpen(true)}
                  className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white transition-colors"
                >
                  <Plus className="size-3" />
                  {t("graph.add")}
                </button>
              )}
            </div>

            {connectedNeighbors.length === 0 ? (
              <div className="rounded-md border border-dashed border-zinc-800 p-2 text-center text-[11px] text-zinc-500">
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
                      className="flex items-center justify-between rounded-md border border-white/[0.04] bg-zinc-950/40 p-1.5 text-xs hover:bg-zinc-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isNeighborContact && neighborContact ? (
                          <Avatar className="size-5 shrink-0 bg-zinc-800">
                            <AvatarFallback className="text-[9px] bg-zinc-800 text-zinc-300">
                              {initials(neighborContact.name)}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="flex size-5 shrink-0 items-center justify-center rounded bg-zinc-800 text-zinc-400">
                            <Building2 className="size-2.5" />
                          </div>
                        )}

                        <div className="min-w-0">
                          <p className="font-medium text-zinc-200 truncate text-[11px]">{neighbor.name}</p>
                          <p className="text-[10px] text-zinc-500 truncate">
                            {link.relationship || (isNeighborContact ? t("contact.defaultRelationship") : t("inspector.organization"))}
                          </p>
                        </div>
                      </div>

                      {isNeighborContact && (
                        <Link
                          href={`/contacts/${neighbor.id}`}
                          className="text-zinc-500 hover:text-zinc-200 p-0.5"
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

          {/* Quick Note */}
          {isContact && contactNode && (
            <div className="space-y-1.5 pt-1.5 border-t border-white/[0.06]">
              <span className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                <MessageSquare className="size-3 text-zinc-500" />
                {t("inspector.newEntry")}
              </span>
              <div className="space-y-1.5">
                <Textarea
                  value={quickNote}
                  onChange={(e) => setQuickNote(e.target.value)}
                  placeholder={t("inspector.notePlaceholder")}
                  className="min-h-12 resize-none bg-zinc-950/60 border-zinc-800 text-xs rounded-md"
                  disabled={isSubmittingNote}
                />
                <Button
                  size="sm"
                  onClick={handleAddNote}
                  disabled={isSubmittingNote || !quickNote.trim()}
                  className="w-full bg-zinc-100 hover:bg-white text-zinc-950 h-6.5 text-xs font-medium gap-1"
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

        {/* Footer Actions */}
        {isContact && contactNode && (
          <div className="border-t border-white/[0.06] bg-zinc-900 p-2">
            <Link
              href={`/contacts/${contactNode.id}`}
              className="flex items-center justify-center w-full rounded border border-white/[0.08] bg-zinc-800/80 hover:bg-zinc-800 text-zinc-200 text-xs h-7 gap-1.5 transition-colors"
            >
              <ExternalLink className="size-3 text-zinc-400" />
              {t("inspector.fullProfile")}
            </Link>
          </div>
        )}
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
    </>
  );
}
