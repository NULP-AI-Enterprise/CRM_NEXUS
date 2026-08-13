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
      <div className="rounded-xl border border-dashed border-border bg-muted p-10 text-center text-xs text-muted-foreground">
        <UsersRound className="mx-auto size-6 text-muted-foreground mb-2" />
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
            className="rounded-xl border border-border bg-card px-4 transition-colors hover:border-accent/40"
          >
            <AccordionTrigger className="py-3 hover:no-underline">
              <div className="flex flex-wrap items-center gap-2 text-left">
                <div className="flex size-6 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                  <UsersRound className="size-3.5" />
                </div>
                <span className="font-medium text-foreground text-xs tracking-tight">{community.name}</span>
                {community.description && (
                  <span className="text-[11px] text-muted-foreground font-normal">({community.description})</span>
                )}
                <span className="ml-1 inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground font-mono">
                  <Users className="size-2.5 text-muted-foreground" />
                  {community.contacts.length}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-3.5 pt-0.5">
              <div className="mb-2.5 flex items-center justify-end gap-1">
                <button
                  onClick={() => setEditingCommunity(community)}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Pencil className="size-3" />
                  {t("common.edit")}
                </button>
                <button
                  onClick={() => setDeletingCommunity(community)}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
                >
                  <Trash2 className="size-3" />
                  {t("common.delete")}
                </button>
              </div>
              {community.contacts.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
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
