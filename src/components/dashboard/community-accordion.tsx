"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UsersRound } from "lucide-react";
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
import { EntityCardActions } from "@/components/dashboard/entity-card";
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
      <div className="flex flex-col gap-3">
        {communities.map((community) => (
          <Accordion
            key={community.id}
            defaultValue={defaultValue}
            className="group relative rounded-[16px] border border-border bg-card px-4"
            style={{ borderLeftWidth: "3px", borderLeftColor: "#9B7BE0" }}
          >
            <AccordionItem value={community.id} className="border-b-0">
              <AccordionTrigger className="py-[15px] pr-16 hover:no-underline">
                <div className="flex items-start gap-[10px] text-left">
                  <div
                    className="flex size-7 shrink-0 items-center justify-center rounded-[9px]"
                    style={{ backgroundColor: "#F1EBFC" }}
                  >
                    <UsersRound className="size-4" style={{ color: "#4E3487" }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold leading-[1.3] tracking-[-0.2px] text-foreground">
                      {community.name}
                    </p>
                    {community.description && (
                      <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{community.description}</p>
                    )}
                  </div>
                </div>
              </AccordionTrigger>

              <EntityCardActions
                onEdit={() => setEditingCommunity(community)}
                onDelete={() => setDeletingCommunity(community)}
                className="absolute right-4 top-[15px]"
              />

              <div
                className="flex items-center justify-between rounded-[11px] px-[10px] py-[9px]"
                style={{ backgroundColor: "#FAF7FE", border: "1px solid #EFE6FA" }}
              >
                <div>
                  <div className="font-mono text-[8.5px] uppercase tracking-[0.08em]" style={{ color: "#A79ABF" }}>
                    {t("community.membersLabel")}
                  </div>
                  <div className="mt-0.5 text-[13px] font-semibold" style={{ color: "#41326B" }}>
                    {community.contacts.length}
                  </div>
                </div>
              </div>

              <AccordionContent className="pb-3.5 pt-2.5">
                {community.contacts.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                    {t("community.noContacts")}
                  </div>
                ) : (
                  <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
                    {community.contacts.map((contact) => (
                      <ContactCard key={contact.id} contact={contact} />
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        ))}
      </div>

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
