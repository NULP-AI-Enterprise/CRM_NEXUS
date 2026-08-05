"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Users, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ContactCard } from "@/components/dashboard/contact-card";
import { CompanyFormDialog } from "@/components/dashboard/company-form-dialog";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { useTranslation } from "@/lib/i18n/context";
import type { CompanyModel, ContactModel } from "@/generated/prisma/models";

type CompanyWithContacts = CompanyModel & { contacts: ContactModel[] };

const UNASSIGNED_VALUE = "__unassigned";

export function CompanyAccordion({
  companies,
  unassignedContacts,
}: {
  companies: CompanyWithContacts[];
  unassignedContacts: ContactModel[];
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [editingCompany, setEditingCompany] = useState<CompanyModel | null>(null);
  const [deletingCompany, setDeletingCompany] = useState<CompanyModel | null>(null);

  if (companies.length === 0 && unassignedContacts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-zinc-950/40 p-10 text-center text-xs text-zinc-400">
        <Building2 className="mx-auto size-6 text-zinc-600 mb-2" />
        {t("company.empty")}
      </div>
    );
  }

  const defaultValue = [
    ...companies.map((company) => company.id),
    ...(unassignedContacts.length > 0 ? [UNASSIGNED_VALUE] : []),
  ];

  return (
    <>
      <Accordion defaultValue={defaultValue} className="space-y-2">
        {companies.map((company) => (
          <AccordionItem
            key={company.id}
            value={company.id}
            className="rounded-xl border border-white/[0.07] bg-zinc-900/30 px-4 transition-colors hover:border-white/[0.12]"
          >
            <AccordionTrigger className="py-3 hover:no-underline">
              <div className="flex flex-wrap items-center gap-2 text-left">
                <div className="flex size-6 items-center justify-center rounded-md bg-zinc-800 text-zinc-400">
                  <Building2 className="size-3.5" />
                </div>
                <span className="font-medium text-white text-xs tracking-tight">{company.name}</span>
                {company.industry && (
                  <span className="text-[11px] text-zinc-500 font-normal">({company.industry})</span>
                )}
                <span className="ml-1 inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-400 font-mono">
                  <Users className="size-2.5 text-zinc-500" />
                  {company.contacts.length}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-3.5 pt-0.5">
              <div className="mb-2.5 flex items-center justify-end gap-1">
                <button
                  onClick={() => setEditingCompany(company)}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <Pencil className="size-3" />
                  {t("common.edit")}
                </button>
                <button
                  onClick={() => setDeletingCompany(company)}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-zinc-400 hover:text-red-400 hover:bg-white/5 transition-colors"
                >
                  <Trash2 className="size-3" />
                  {t("common.delete")}
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {company.contacts.map((contact) => (
                  <ContactCard key={contact.id} contact={contact} />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}

        {unassignedContacts.length > 0 && (
          <AccordionItem
            value={UNASSIGNED_VALUE}
            className="rounded-xl border border-white/[0.07] bg-zinc-900/30 px-4 transition-colors hover:border-white/[0.12]"
          >
            <AccordionTrigger className="py-3 hover:no-underline">
              <div className="flex items-center gap-2 text-left">
                <div className="flex size-6 items-center justify-center rounded-md bg-zinc-800 text-zinc-400">
                  <Users className="size-3.5" />
                </div>
                <span className="font-medium text-zinc-300 text-xs">{t("company.noCompany")}</span>
                <span className="rounded-md border border-white/[0.06] bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-400 font-mono">
                  {unassignedContacts.length}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-3.5 pt-0.5">
              <div className="grid gap-2 sm:grid-cols-2">
                {unassignedContacts.map((contact) => (
                  <ContactCard key={contact.id} contact={contact} />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>

      <CompanyFormDialog
        open={Boolean(editingCompany)}
        onOpenChange={(open) => !open && setEditingCompany(null)}
        company={editingCompany}
      />

      {deletingCompany && (
        <ConfirmDeleteDialog
          open={Boolean(deletingCompany)}
          onOpenChange={(open) => !open && setDeletingCompany(null)}
          description={t("company.delete.confirm", { name: deletingCompany.name })}
          onConfirm={async () => {
            try {
              const res = await fetch(`/api/companies/${deletingCompany.id}`, { method: "DELETE" });
              if (!res.ok) throw new Error(t("common.unknownError"));
              toast.success(t("company.delete.success"));
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
