"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Users } from "lucide-react";
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
import { EntityCardActions } from "@/components/dashboard/entity-card";
import { useTranslation } from "@/lib/i18n/context";
import type { CompanyModel, ContactModel } from "@/generated/prisma/models";

type CompanyWithContacts = CompanyModel & { contacts: ContactModel[] };

const UNASSIGNED_VALUE = "__unassigned";
const ROW_COLUMNS = "minmax(0, 1fr) 160px 90px 64px";

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
      <Accordion defaultValue={defaultValue} className="rounded-[16px] border border-border bg-card overflow-hidden">
        <div
          className="grid gap-3 border-b border-border bg-muted/40 px-[18px] py-[11px] font-mono text-[9.5px] uppercase tracking-[0.08em] text-muted-foreground"
          style={{ gridTemplateColumns: ROW_COLUMNS }}
        >
          <div>{t("company.table.company")}</div>
          <div>{t("company.table.industry")}</div>
          <div>{t("company.table.contacts")}</div>
          <div />
        </div>

        {companies.map((company) => (
          <AccordionItem key={company.id} value={company.id} className="group relative not-last:border-b border-border">
            <AccordionTrigger className="px-[18px] py-[13px] pr-16 hover:no-underline hover:bg-muted/40 rounded-none">
              <div
                className="grid w-full items-center gap-3"
                style={{ gridTemplateColumns: ROW_COLUMNS }}
              >
                <div className="flex items-center gap-[9px] min-w-0">
                  <Building2 className="size-3.5 shrink-0" style={{ color: "#43A883" }} />
                  <span className="truncate text-[13px] font-semibold text-foreground">{company.name}</span>
                </div>
                <div className="truncate text-[12px] text-muted-foreground">{company.industry ?? "—"}</div>
                <div className="text-[12px] text-muted-foreground">{company.contacts.length}</div>
                <div />
              </div>
            </AccordionTrigger>
            <EntityCardActions
              onEdit={() => setEditingCompany(company)}
              onDelete={() => setDeletingCompany(company)}
              className="absolute right-[18px] top-1/2 -translate-y-1/2"
            />
            <AccordionContent className="px-[18px] pb-4 pt-0">
              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
                {company.contacts.map((contact) => (
                  <ContactCard key={contact.id} contact={contact} />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}

        {unassignedContacts.length > 0 && (
          <AccordionItem value={UNASSIGNED_VALUE} className="group relative">
            <AccordionTrigger className="px-[18px] py-[13px] hover:no-underline hover:bg-muted/40 rounded-none">
              <div className="flex items-center gap-[9px]">
                <Users className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="text-[13px] font-semibold text-foreground">{t("company.noCompany")}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{unassignedContacts.length}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-[18px] pb-4 pt-0">
              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
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
