"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { MiniRelationshipGraph, type MiniGraphEdge, type MiniGraphNode } from "@/components/graph/mini-network-graph";
import { AddConnectionDialog } from "@/components/graph/add-connection-dialog";
import { useTranslation } from "@/lib/i18n/context";
import type { ContactCategory } from "@/generated/prisma/enums";

interface MiniContact {
  id: string;
  fullName: string;
  role?: string | null;
  category: ContactCategory;
  relationship?: string | null;
  companyName?: string | null;
}

interface ContactLocalGraphProps {
  currentContact: {
    id: string;
    fullName: string;
    role?: string | null;
    category: ContactCategory;
    companyName?: string | null;
  };
  connectedContacts: MiniContact[];
  colleagues: MiniContact[];
  otherAvailableContacts: Array<{ id: string; fullName: string; role?: string | null; companyName?: string | null }>;
}

/** Bridges the contact-detail page's own connection/colleague shapes into the
 * shared `MiniRelationshipGraph` renderer, and owns the one bit of page-
 * specific behavior the graph itself has no business knowing about:
 * navigating to a peer's page, and opening the "add connection" dialog. */
export function ContactLocalGraph({ currentContact, connectedContacts, colleagues, otherAvailableContacts }: ContactLocalGraphProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const [isConnectOpen, setIsConnectOpen] = useState(false);

  const peers = useMemo(() => {
    const map = new Map<string, MiniContact>();
    for (const c of connectedContacts) map.set(c.id, c);
    for (const col of colleagues) {
      if (!map.has(col.id)) map.set(col.id, { ...col, relationship: t("relationship.colleague") });
    }
    return Array.from(map.values());
  }, [connectedContacts, colleagues, t]);

  const nodes: MiniGraphNode[] = useMemo(
    () => [
      { id: currentContact.id, name: currentContact.fullName, category: currentContact.category, isCenter: true },
      ...peers.map((p) => ({ id: p.id, name: p.fullName, category: p.category })),
    ],
    [currentContact, peers],
  );

  const edges: MiniGraphEdge[] = useMemo(
    () => peers.map((p) => ({ aId: currentContact.id, bId: p.id, relationship: p.relationship })),
    [currentContact.id, peers],
  );

  return (
    <>
      <MiniRelationshipGraph
        title={t("graph.localGraph")}
        nodes={nodes}
        edges={edges}
        onNodeClick={(id) => router.push(`/contacts/${id}`)}
        addButton={{ label: t("graph.add"), onClick: () => setIsConnectOpen(true) }}
        emptyLabel={t("graph.noDirectConnections")}
        emptyAction={{ label: t("graph.connect"), onClick: () => setIsConnectOpen(true) }}
      />

      <AddConnectionDialog
        open={isConnectOpen}
        onOpenChange={setIsConnectOpen}
        fromContact={{ id: currentContact.id, name: currentContact.fullName }}
        availableContacts={otherAvailableContacts}
        onSuccess={() => router.refresh()}
      />
    </>
  );
}
