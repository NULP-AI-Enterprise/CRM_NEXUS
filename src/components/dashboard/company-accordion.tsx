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
      <div className="rounded-xl border border-dashed border-border bg-muted p-10 text-center text-xs text-muted-foreground">
        <Building2 className="mx-auto size-6 text-muted-foreground mb-2" />
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
            className="rounded-xl border border-border bg-card px-4 transition-colors hover:border-accent/40"
          >
            <AccordionTrigger className="py-3 hover:no-underline">
              <div className="flex flex-wrap items-center gap-2 text-left">
                <div className="flex size-6 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                  <Building2 className="size-3.5" />
                </div>
                <span className="font-medium text-foreground text-xs tracking-tight">{company.name}</span>
                {company.industry && (
                  <span className="text-[11px] text-muted-foreground font-normal">({company.industry})</span>
                )}
                <span className="ml-1 inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground font-mono">
                  <Users className="size-2.5 text-muted-foreground" />
                  {company.contacts.length}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-3.5 pt-0.5">
              <div className="mb-2.5 flex items-center justify-end gap-1">
                <button
                  onClick={() => setEditingCompany(company)}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Pencil className="size-3" />
                  {t("common.edit")}
                </button>
                <button
                  onClick={() => setDeletingCompany(company)}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
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
            className="rounded-xl border border-border bg-card px-4 transition-colors hover:border-accent/40"
          >
            <AccordionTrigger className="py-3 hover:no-underline">
              <div className="flex items-center gap-2 text-left">
                <div className="flex size-6 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                  <Users className="size-3.5" />
                </div>
                <span className="font-medium text-foreground text-xs">{t("company.noCompany")}</span>
                <span className="rounded-md border border-border bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground font-mono">
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
