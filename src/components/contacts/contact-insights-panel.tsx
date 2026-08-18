"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Link2, Trash2, Plus, ExternalLink, UsersRound, Star } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EntityIconBadge } from "@/components/dashboard/entity-card";
import { initials } from "@/lib/contact-display";
import { useTranslation } from "@/lib/i18n/context";
import type { CompanyModel, ContactModel, ContactConnectionModel } from "@/generated/prisma/models";
import { AddConnectionDialog } from "@/components/graph/add-connection-dialog";

type ConnectionWithContact = ContactConnectionModel & {
  toContact?: ContactModel & { company?: CompanyModel | null };
  fromContact?: ContactModel & { company?: CompanyModel | null };
};

type ContactDetailType = ContactModel & {
  communities?: Array<{ id: string; name: string }>;
  outgoingConnections: ConnectionWithContact[];
  incomingConnections: ConnectionWithContact[];
  otherContacts: Array<{
    id: string;
    fullName: string;
    role?: string | null;
    companyName?: string | null;
  }>;
};

export function ContactInsightsPanel({ contact }: { contact: ContactDetailType }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [expandedConnectionId, setExpandedConnectionId] = useState<string | null>(null);

  // Flatten all connections
  const directConnections = [
    ...contact.outgoingConnections.map((c) => ({
      id: c.id,
      relationship: c.relationship,
      strength: c.strength,
      notes: c.notes,
      peer: c.toContact,
      isOutgoing: true,
    })),
    ...contact.incomingConnections.map((c) => ({
      id: c.id,
      relationship: c.relationship,
      strength: c.strength,
      notes: c.notes,
      peer: c.fromContact,
      isOutgoing: false,
    })),
  ].filter((c) => Boolean(c.peer));

  const handleDeleteConnection = (connectionId: string) => {
    startDeleteTransition(async () => {
      try {
        const res = await fetch(`/api/connections?id=${connectionId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          throw new Error(t("contact.connectionRemoveError"));
        }
        toast.success(t("contact.connectionRemoved"));
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("common.unknownError"));
      }
    });
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Community Memberships */}
      {contact.communities && contact.communities.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <UsersRound className="size-3.5 text-muted-foreground" />
          {contact.communities.map((community) => (
            <span
              key={community.id}
              className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              {community.name}
            </span>
          ))}
        </div>
      )}

      {/* Direct Network Connections Manager — the "Relationships" column,
          matching Weave's detail-page anatomy. Temperament/needs/valuePotential/
          fullSummary render in ContactProfileBody (the left column) instead. */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="size-3.5 text-muted-foreground" />
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
              {t("contact.connectionsTitle")}
            </h3>
            <span className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground font-mono">
              {directConnections.length}
            </span>
          </div>
          <Button
            size="sm"
            onClick={() => setIsConnectOpen(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-7 px-3 gap-1.5 rounded-md font-medium"
          >
            <Plus className="size-3" />
            {t("contact.addConnection")}
          </Button>
        </div>

        {directConnections.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            {t("contact.noConnections")}
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {directConnections.map((conn) => {
              const peer = conn.peer!;
              const hasExpandableContent = conn.strength != null || Boolean(conn.notes);
              const isExpanded = expandedConnectionId === conn.id;

              return (
                <div
                  key={conn.id}
                  onClick={
                    hasExpandableContent
                      ? () => setExpandedConnectionId(isExpanded ? null : conn.id)
                      : undefined
                  }
                  className={`group relative flex flex-col gap-2 rounded-lg border border-border bg-muted/60 p-2.5 text-xs transition-colors hover:bg-muted ${hasExpandableContent ? "cursor-pointer" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative shrink-0">
                        <Avatar className="size-7 bg-secondary">
                          <AvatarFallback className="text-[10px] font-medium bg-secondary text-secondary-foreground">
                            {initials(peer.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <EntityIconBadge
                          icon={Link2}
                          className="absolute -bottom-1 -right-1 size-3.5 rounded-full border-2 border-card bg-secondary p-0 [&>svg]:size-2"
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={`/contacts/${peer.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="relative z-10 font-medium text-foreground hover:underline truncate text-xs"
                          >
                            {peer.fullName}
                          </Link>
                          <span className="text-[10px] text-muted-foreground rounded bg-card px-1 py-0.2 border border-border">
                            {conn.relationship || t("contact.defaultRelationship")}
                          </span>
                        </div>
                        <p className="text-muted-foreground text-[11px] truncate">
                          {peer.role || peer.companyName || t("contact.defaultRole")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      <Link
                        href={`/contacts/${peer.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="relative z-10 p-1 text-muted-foreground hover:text-foreground rounded"
                        title={t("contact.viewProfile")}
                      >
                        <ExternalLink className="size-3" />
                      </Link>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteConnection(conn.id);
                        }}
                        disabled={isDeleting}
                        className="relative z-10 p-1 text-muted-foreground hover:text-destructive rounded transition-colors"
                        title={t("contact.removeConnection")}
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="space-y-1.5 border-t border-border pt-2">
                      {conn.strength != null && (
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Star className="size-3 fill-muted-foreground" />
                          {t("connection.strength")}: {conn.strength}/5
                        </div>
                      )}
                      {conn.notes && (
                        <p className="text-[11px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
                          {conn.notes}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AddConnectionDialog
        open={isConnectOpen}
        onOpenChange={setIsConnectOpen}
        fromContact={{ id: contact.id, name: contact.fullName }}
        availableContacts={contact.otherContacts}
        onSuccess={() => {
          router.refresh();
        }}
      />
    </div>
  );
}
