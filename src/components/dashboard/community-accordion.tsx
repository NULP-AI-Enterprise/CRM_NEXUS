"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UsersRound, Users, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ContactCard } from "@/components/dashboard/contact-card";
import { CommunityFormDialog } from "@/components/dashboard/community-form-dialog";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { useTranslation } from "@/lib/i18n/context";
import type { CommunityModel, ContactModel } from "@/generated/prisma/models";

type CommunityWithContacts = CommunityModel & { contacts: ContactModel[] };

export function CommunityAccordion({ communities }: { communities: CommunityWithContacts[] }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [editingCommunity, setEditingCommunity] = useState<CommunityModel | null>(null);
  const [deletingCommunity, setDeletingCommunity] = useState<CommunityModel | null>(null);

  if (communities.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-zinc-950/40 p-10 text-center text-xs text-zinc-400">
        <UsersRound className="mx-auto size-6 text-zinc-600 mb-2" />
        {t("community.empty")}
      </div>
    );
  }

  const defaultValue = communities.map((community) => community.id);

  return (
    <>
      <Accordion defaultValue={defaultValue} className="space-y-2">
        {communities.map((community) => (
          <AccordionItem
            key={community.id}
            value={community.id}
            className="rounded-xl border border-white/[0.07] bg-zinc-900/30 px-4 transition-colors hover:border-white/[0.12]"
          >
            <AccordionTrigger className="py-3 hover:no-underline">
              <div className="flex flex-wrap items-center gap-2 text-left">
                <div className="flex size-6 items-center justify-center rounded-md bg-zinc-800 text-zinc-400">
                  <UsersRound className="size-3.5" />
                </div>
                <span className="font-medium text-white text-xs tracking-tight">{community.name}</span>
                {community.description && (
                  <span className="text-[11px] text-zinc-500 font-normal">({community.description})</span>
                )}
                <span className="ml-1 inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-400 font-mono">
                  <Users className="size-2.5 text-zinc-500" />
                  {community.contacts.length}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-3.5 pt-0.5">
              <div className="mb-2.5 flex items-center justify-end gap-1">
                <button
                  onClick={() => setEditingCommunity(community)}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <Pencil className="size-3" />
                  {t("common.edit")}
                </button>
                <button
                  onClick={() => setDeletingCommunity(community)}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-zinc-400 hover:text-red-400 hover:bg-white/5 transition-colors"
                >
                  <Trash2 className="size-3" />
                  {t("common.delete")}
                </button>
              </div>
              {community.contacts.length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-800 p-6 text-center text-xs text-zinc-500">
                  {t("community.noContacts")}
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {community.contacts.map((contact) => (
                    <ContactCard key={contact.id} contact={contact} />
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <CommunityFormDialog
        open={Boolean(editingCommunity)}
        onOpenChange={(open) => !open && setEditingCommunity(null)}
        community={editingCommunity}
      />

      {deletingCommunity && (
        <ConfirmDeleteDialog
          open={Boolean(deletingCommunity)}
          onOpenChange={(open) => !open && setDeletingCommunity(null)}
          description={t("community.delete.confirm", { name: deletingCommunity.name })}
          onConfirm={async () => {
            try {
              const res = await fetch(`/api/communities/${deletingCommunity.id}`, { method: "DELETE" });
              if (!res.ok) throw new Error(t("common.unknownError"));
              toast.success(t("community.delete.success"));
              router.refresh();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : t("common.unknownError"));
            }
          }}
        />
      )}
    </>
  );
}
