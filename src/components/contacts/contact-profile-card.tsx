"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Brain,
  Star,
  Sparkles,
  Link2,
  Trash2,
  Plus,
  ExternalLink,
  Target,
  MessageSquare,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CATEGORY_COLORS, initials } from "@/lib/contact-display";
import { useTranslation } from "@/lib/i18n/context";
import type { CompanyModel, ContactModel, ContactConnectionModel } from "@/generated/prisma/models";
import { AddConnectionDialog } from "@/components/graph/add-connection-dialog";
import { ContactFormDialog } from "@/components/contacts/contact-form-dialog";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";

type ConnectionWithContact = ContactConnectionModel & {
  toContact?: ContactModel & { company?: CompanyModel | null };
  fromContact?: ContactModel & { company?: CompanyModel | null };
};

type ContactDetailType = ContactModel & {
  company: (CompanyModel & {
    contacts?: Array<{ id: string; fullName: string; role?: string | null; category: string }>;
  }) | null;
  outgoingConnections: ConnectionWithContact[];
  incomingConnections: ConnectionWithContact[];
  otherContacts: Array<{
    id: string;
    fullName: string;
    role?: string | null;
    companyName?: string | null;
  }>;
};

export function ContactProfileCard({
  contact,
  companies,
}: {
  contact: ContactDetailType;
  companies: Array<{ id: string; name: string }>;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();

  const colors = CATEGORY_COLORS[contact.category] || CATEGORY_COLORS.OTHER;

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

  const handleDeleteContact = async () => {
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(t("common.unknownError"));
      toast.success(t("contact.delete.success"));
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.unknownError"));
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Top Main Info Card */}
      <div className="rounded-xl border border-white/[0.08] bg-zinc-900/40 p-5 relative">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <Avatar className="size-14 border border-white/[0.08] bg-zinc-800 shrink-0">
              <AvatarFallback className="text-sm font-medium bg-zinc-800 text-zinc-200">
                {initials(contact.fullName)}
              </AvatarFallback>
            </Avatar>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-white tracking-tight">{contact.fullName}</h1>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-zinc-900 px-2 py-0.5 text-xs text-zinc-300">
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: colors.dot }}
                  />
                  {t(`category.${contact.category}`)}
                </span>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-2.5 text-xs text-zinc-400">
                {contact.role && <span>{contact.role}</span>}
                {contact.company && (
                  <>
                    <span className="text-zinc-600">•</span>
                    <Link
                      href="/dashboard"
                      className="flex items-center gap-1 text-zinc-300 hover:text-white transition-colors"
                    >
                      <Building2 className="size-3 text-zinc-500" />
                      {contact.company.name}
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {contact.usefulnessScore != null && (
              <div className="flex items-center gap-2 rounded-lg bg-zinc-900 border border-white/[0.08] px-3 py-1.5 text-zinc-200">
                <Star className="size-4 text-zinc-400" />
                <div>
                  <div className="text-[10px] uppercase text-zinc-500 font-medium">{t("contact.valueScore")}</div>
                  <div className="text-sm font-semibold font-mono text-white leading-tight">
                    {contact.usefulnessScore} / 10
                  </div>
                </div>
              </div>
            )}
            <Button
              size="icon"
              variant="outline"
              onClick={() => setIsEditOpen(true)}
              className="size-8 border-white/[0.08] bg-zinc-900 text-zinc-300 hover:text-white"
              title={t("common.edit")}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={() => setIsDeleteOpen(true)}
              className="size-8 border-white/[0.08] bg-zinc-900 text-zinc-400 hover:text-red-400"
              title={t("common.delete")}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Strategic Profile Matrix */}
      <div className="grid gap-3 sm:grid-cols-3">
        {/* Card 1: Temperament */}
        <div className="rounded-xl border border-white/[0.08] bg-zinc-900/30 p-4 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
            <Brain className="size-3.5 text-zinc-500" />
            {t("contact.temperament")}
          </div>
          <p className="text-xs text-zinc-200 leading-relaxed">
            {contact.temperament || t("contact.temperamentEmpty")}
          </p>
        </div>

        {/* Card 2: Needs */}
        <div className="rounded-xl border border-white/[0.08] bg-zinc-900/30 p-4 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
            <Target className="size-3.5 text-zinc-500" />
            {t("contact.needs")}
          </div>
          <p className="text-xs text-zinc-200 leading-relaxed">
            {contact.needs || t("contact.needsEmpty")}
          </p>
        </div>

        {/* Card 3: Value Potential */}
        <div className="rounded-xl border border-white/[0.08] bg-zinc-900/30 p-4 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
            <Sparkles className="size-3.5 text-zinc-500" />
            {t("contact.valuePotential")}
          </div>
          <p className="text-xs text-zinc-200 leading-relaxed">
            {contact.valuePotential || t("contact.valuePotentialEmpty")}
          </p>
        </div>
      </div>

      {/* Full AI Summary */}
      {contact.fullSummary && (
        <div className="rounded-xl border border-white/[0.08] bg-zinc-900/30 p-4 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
            <MessageSquare className="size-3.5 text-zinc-500" />
            {t("contact.fullSummary")}
          </div>
          <p className="text-xs leading-relaxed text-zinc-300 whitespace-pre-wrap">
            {contact.fullSummary}
          </p>
        </div>
      )}

      {/* Direct Network Connections Manager */}
      <div className="rounded-xl border border-white/[0.08] bg-zinc-900/30 p-4 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="size-3.5 text-zinc-400" />
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
              {t("contact.connectionsTitle")}
            </h3>
            <span className="rounded-md border border-white/[0.06] bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-400 font-mono">
              {directConnections.length}
            </span>
          </div>
          <Button
            size="sm"
            onClick={() => setIsConnectOpen(true)}
            className="bg-white hover:bg-zinc-200 text-zinc-950 text-xs h-7 px-3 gap-1.5 rounded-md font-medium"
          >
            <Plus className="size-3" />
            {t("contact.addConnection")}
          </Button>
        </div>

        {directConnections.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-800 p-6 text-center text-xs text-zinc-500">
            {t("contact.noConnections")}
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {directConnections.map((conn) => {
              const peer = conn.peer!;

              return (
                <div
                  key={conn.id}
                  className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-zinc-950/40 p-2.5 text-xs transition-colors hover:bg-zinc-900/60"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar className="size-7 shrink-0 bg-zinc-800">
                      <AvatarFallback className="text-[10px] font-medium bg-zinc-800 text-zinc-300">
                        {initials(peer.fullName)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/contacts/${peer.id}`}
                          className="font-medium text-white hover:underline truncate text-xs"
                        >
                          {peer.fullName}
                        </Link>
                        <span className="text-[10px] text-zinc-400 rounded bg-zinc-900 px-1 py-0.2 border border-white/[0.06]">
                          {conn.relationship || t("contact.defaultRelationship")}
                        </span>
                      </div>
                      <p className="text-zinc-500 text-[11px] truncate">
                        {peer.role || peer.companyName || t("contact.defaultRole")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <Link
                      href={`/contacts/${peer.id}`}
                      className="p-1 text-zinc-400 hover:text-white rounded"
                      title={t("contact.viewProfile")}
                    >
                      <ExternalLink className="size-3" />
                    </Link>
                    <button
                      onClick={() => handleDeleteConnection(conn.id)}
                      disabled={isDeleting}
                      className="p-1 text-zinc-500 hover:text-red-400 rounded transition-colors"
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

      <ContactFormDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        companies={companies}
        contact={contact}
      />

      <ConfirmDeleteDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        description={t("contact.delete.confirm", { name: contact.fullName })}
        onConfirm={handleDeleteContact}
      />
    </div>
  );
}
