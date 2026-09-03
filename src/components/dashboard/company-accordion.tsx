"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
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
import type { CompanyModel, ContactModel } from "@/generated/prisma/models";

type CompanyWithContacts = CompanyModel & { contacts: ContactModel[] };

// On md+ show all four columns; below that collapse to just name + count
const ROW_COLUMNS_MD = "minmax(0, 1fr) 160px 80px 56px";
const ROW_COLUMNS_SM = "minmax(0, 1fr) 60px";

export function CompanyAccordion({ companies }: { companies: CompanyWithContacts[] }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [deletingCompany, setDeletingCompany] = useState<CompanyModel | null>(null);

  if (companies.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted p-10 text-center text-xs text-muted-foreground">
        <Building2 className="mx-auto size-6 text-muted-foreground mb-2" />
        {t("company.empty")}
      </div>
    );
  }

  const defaultValue = companies.map((company) => company.id);

  return (
    <>
      <Accordion defaultValue={defaultValue} className="rounded-[16px] border border-border bg-card overflow-hidden">
        {/* Column headers — full set on md+, minimal on smaller screens */}
        <div
          className="hidden border-b border-border bg-muted/40 px-[18px] py-[11px] font-mono text-[9.5px] uppercase tracking-[0.08em] text-muted-foreground md:grid md:gap-3"
          style={{ gridTemplateColumns: ROW_COLUMNS_MD }}
        >
          <div>{t("company.table.company")}</div>
          <div>{t("company.table.industry")}</div>
          <div>{t("company.table.contacts")}</div>
          <div />
        </div>
        <div
          className="grid gap-3 border-b border-border bg-muted/40 px-[18px] py-[11px] font-mono text-[9.5px] uppercase tracking-[0.08em] text-muted-foreground md:hidden"
          style={{ gridTemplateColumns: ROW_COLUMNS_SM }}
        >
          <div>{t("company.table.company")}</div>
          <div>{t("company.table.contacts")}</div>
        </div>

        {companies.map((company) => (
          <AccordionItem key={company.id} value={company.id} className="group relative not-last:border-b border-border">
            <AccordionTrigger className="px-[18px] py-[13px] pr-32 hover:no-underline hover:bg-muted/40 rounded-none">
              {/* Full row on md+ */}
              <div
                className="hidden w-full items-center gap-3 md:grid"
                style={{ gridTemplateColumns: ROW_COLUMNS_MD }}
              >
                <div className="flex items-center gap-[9px] min-w-0">
                  <Building2 className="size-3.5 shrink-0" style={{ color: "#43A883" }} />
                  <span 
                    className="truncate text-[13px] font-semibold text-foreground cursor-pointer hover:underline"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      router.push(`/companies/${company.id}`);
                    }}
                  >
                    {company.name}
                  </span>
                </div>
                <div className="truncate text-[12px] text-muted-foreground">{company.industry ?? "—"}</div>
                <div className="text-[12px] text-muted-foreground">{company.contacts.length}</div>
                <div />
              </div>
              {/* Compact row on small screens */}
              <div
                className="grid w-full items-center gap-3 md:hidden"
                style={{ gridTemplateColumns: ROW_COLUMNS_SM }}
              >
                <div className="flex items-center gap-[9px] min-w-0">
                  <Building2 className="size-3.5 shrink-0" style={{ color: "#43A883" }} />
                  <span 
                    className="truncate text-[13px] font-semibold text-foreground cursor-pointer hover:underline"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      router.push(`/companies/${company.id}`);
                    }}
                  >
                    {company.name}
                  </span>
                </div>
                <div className="text-[12px] text-muted-foreground">{company.contacts.length}</div>
              </div>
            </AccordionTrigger>
            <div className="absolute right-[18px] top-1/2 flex -translate-y-1/2 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              <EntityCardActions onDelete={() => setDeletingCompany(company)} className="opacity-100" />
            </div>
            <AccordionContent className="px-[18px] pb-4 pt-0">
              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
                {company.contacts.map((contact) => (
                  <ContactCard key={contact.id} contact={contact} />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

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
