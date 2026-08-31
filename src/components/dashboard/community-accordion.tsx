"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Maximize2, UsersRound } from "lucide-react";
import { toast } from "sonner";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ContactCard } from "@/components/dashboard/contact-card";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { EntityCardActions } from "@/components/dashboard/entity-card";
import { useTranslation } from "@/lib/i18n/context";
import type { CommunityModel, ContactModel } from "@/generated/prisma/models";

type CommunityWithContacts = CommunityModel & { contacts: ContactModel[] };

export function CommunityAccordion({ communities }: { communities: CommunityWithContacts[] }) {
  const { t } = useTranslation();
  const router = useRouter();
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
              <AccordionTrigger className="py-[15px] pr-32 hover:no-underline">
                <div className="flex items-center gap-[10px] text-left">
                  <div
                    className="flex size-7 shrink-0 items-center justify-center rounded-[9px]"
                    style={{ backgroundColor: "#F1EBFC" }}
                  >
                    <UsersRound className="size-4" style={{ color: "#4E3487" }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[14px] font-semibold leading-[1.3] tracking-[-0.2px] text-foreground">
                        {community.name}
                      </p>
                      <span
                        className="shrink-0 rounded-[6px] px-[7px] py-[2px] font-mono text-[10px] font-medium"
                        style={{ backgroundColor: "#F1EBFC", color: "#7B5BBF" }}
                      >
                        {community.contacts.length}
                      </span>
                    </div>
                    {community.description && (
                      <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{community.description}</p>
                    )}
                  </div>
                </div>
              </AccordionTrigger>

              <div className="absolute right-4 top-[15px] flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/communities/${community.id}`);
                  }}
                  title={t("community.detail.viewDetails")}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Maximize2 className="size-3" />
                </button>
                <EntityCardActions onDelete={() => setDeletingCommunity(community)} className="opacity-100" />
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
