"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Link2, Trash2, Plus, ExternalLink, UsersRound, Star } from "lucide-react";
import { toast } from "sonner";

import { initials, CATEGORY_COLORS } from "@/lib/contact-display";
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
        const res = await fetch(`/api/connections?id=${connectionId}`, { method: "DELETE" });
        if (!res.ok) throw new Error(t("contact.connectionRemoveError"));
        toast.success(t("contact.connectionRemoved"));
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("common.unknownError"));
      }
    });
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Community memberships — pill strip */}
      {contact.communities && contact.communities.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <UsersRound className="size-3.5 text-muted-foreground" />
          {contact.communities.map((community) => (
            <span
              key={community.id}
              className="inline-flex items-center rounded-[7px] border border-[#EFE6FA] bg-[#FAF7FE] px-2 py-[3px] text-[11px] text-[#7B5BBF]"
            >
              {community.name}
            </span>
          ))}
        </div>
      )}

      {/* Connections panel */}
      <div className="rounded-[16px] border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-[18px] py-[13px] border-b border-border">
          <div className="flex items-center gap-2">
            <Link2 className="size-3.5 text-[#9a9a94]" />
            <span className="kicker" style={{ fontSize: "9.5px" }}>{t("contact.connectionsTitle")}</span>
            <span
              className="rounded-[6px] px-[7px] py-[2px] font-mono text-[10px]"
              style={{ backgroundColor: "#f1f0ec", color: "#6e7480" }}
            >
              {directConnections.length}
            </span>
          </div>
          <button
            onClick={() => setIsConnectOpen(true)}
            className="flex items-center gap-1.5 rounded-[9px] bg-[#1b1d21] px-[11px] py-[6px] text-[11.5px] font-semibold text-white transition-colors hover:bg-[#33363d]"
          >
            <Plus className="size-3" />
            {t("contact.addConnection")}
          </button>
        </div>

        {directConnections.length === 0 ? (
          <div className="px-[18px] py-10 text-center text-[12px] text-muted-foreground">
            {t("contact.noConnections")}
          </div>
        ) : (
          <div className="grid gap-[1px] bg-border sm:grid-cols-2">
            {directConnections.map((conn) => {
              const peer = conn.peer!;
              const colors = CATEGORY_COLORS[(peer as ContactModel).category] || CATEGORY_COLORS.OTHER;
              const hasExpandable = conn.strength != null || Boolean(conn.notes);
              const isExpanded = expandedConnectionId === conn.id;

              return (
                <div
                  key={conn.id}
                  onClick={hasExpandable ? () => setExpandedConnectionId(isExpanded ? null : conn.id) : undefined}
                  className={`group relative flex flex-col gap-2.5 bg-card px-[14px] py-[12px] transition-colors hover:bg-muted/40 ${hasExpandable ? "cursor-pointer" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-[9px] min-w-0">
                      {/* Inline circle avatar — no shadcn Avatar */}
                      <div
                        className="flex size-[30px] shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                        style={{ backgroundColor: colors.bg, color: colors.text }}
                      >
                        {initials(peer.fullName)}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Link
                            href={`/contacts/${peer.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="relative z-10 truncate text-[12.5px] font-semibold text-foreground hover:underline"
                          >
                            {peer.fullName}
                          </Link>
                          {conn.relationship && (
                            <span
                              className="rounded-[5px] border px-[6px] py-[2px] text-[10px] text-muted-foreground"
                              style={{ borderColor: "#edece8", backgroundColor: "#f7f7f4" }}
                            >
                              {conn.relationship}
                            </span>
                          )}
                        </div>
                        <p className="mt-[1px] truncate text-[11px] text-muted-foreground">
                          {(peer as ContactModel).role || (peer as ContactModel).companyName || t("contact.defaultRole")}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      <Link
                        href={`/contacts/${peer.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="relative z-10 rounded-[7px] p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        title={t("contact.viewProfile")}
                      >
                        <ExternalLink className="size-3" />
                      </Link>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteConnection(conn.id); }}
                        disabled={isDeleting}
                        className="relative z-10 rounded-[7px] p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                        title={t("contact.removeConnection")}
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (conn.strength != null || conn.notes) && (
                    <div className="space-y-1.5 border-t border-border pt-2.5">
                      {conn.strength != null && (
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Star className="size-3 fill-muted-foreground" />
                          {t("connection.strength")}: {conn.strength}/5
                        </div>
                      )}
                      {conn.notes && (
                        <p className="text-[11.5px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
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
        onSuccess={() => { router.refresh(); }}
      />
    </div>
  );
}
