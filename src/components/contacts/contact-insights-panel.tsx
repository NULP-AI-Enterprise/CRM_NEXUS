"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brain, Sparkles, Link2, Trash2, Plus, ExternalLink, Target, MessageSquare, UsersRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

      {/* Strategic Profile Matrix */}
      <div className="grid gap-3 sm:grid-cols-3">
        {/* Card 1: Temperament */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            <Brain className="size-3.5 text-muted-foreground" />
            {t("contact.temperament")}
          </div>
          <p className="text-xs text-foreground leading-relaxed">
            {contact.temperament || t("contact.temperamentEmpty")}
          </p>
        </div>

        {/* Card 2: Needs */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            <Target className="size-3.5 text-muted-foreground" />
            {t("contact.needs")}
          </div>
          <p className="text-xs text-foreground leading-relaxed">
            {contact.needs || t("contact.needsEmpty")}
          </p>
        </div>

        {/* Card 3: Value Potential */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            <Sparkles className="size-3.5 text-muted-foreground" />
            {t("contact.valuePotential")}
          </div>
          <p className="text-xs text-foreground leading-relaxed">
            {contact.valuePotential || t("contact.valuePotentialEmpty")}
          </p>
        </div>
      </div>

      {/* Full AI Summary */}
      {contact.fullSummary && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            <MessageSquare className="size-3.5 text-muted-foreground" />
            {t("contact.fullSummary")}
          </div>
          <p className="text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap">
            {contact.fullSummary}
          </p>
        </div>
      )}

      {/* Direct Network Connections Manager */}
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

              return (
                <div
                  key={conn.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-muted/60 p-2.5 text-xs transition-colors hover:bg-muted"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar className="size-7 shrink-0 bg-secondary">
                      <AvatarFallback className="text-[10px] font-medium bg-secondary text-secondary-foreground">
                        {initials(peer.fullName)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/contacts/${peer.id}`}
                          className="font-medium text-foreground hover:underline truncate text-xs"
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

                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <Link
                      href={`/contacts/${peer.id}`}
                      className="p-1 text-muted-foreground hover:text-foreground rounded"
                      title={t("contact.viewProfile")}
                    >
                      <ExternalLink className="size-3" />
                    </Link>
                    <button
                      onClick={() => handleDeleteConnection(conn.id)}
                      disabled={isDeleting}
                      className="p-1 text-muted-foreground hover:text-destructive rounded transition-colors"
                      title={t("contact.removeConnection")}
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
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
