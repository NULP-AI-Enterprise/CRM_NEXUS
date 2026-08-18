"use client";

import { useTranslation } from "@/lib/i18n/context";
import type { CompanyModel, ContactModel } from "@/generated/prisma/models";

type ContactWithCompany = ContactModel & { company?: CompanyModel | null };

export function ContactProfileBody({ contact }: { contact: ContactWithCompany }) {
  const { t } = useTranslation();

  const location = [contact.city, contact.country].filter(Boolean).join(", ");
  const companyName = contact.company?.name ?? contact.companyName;

  const fields = [
    { label: t("contact.form.role"), value: contact.role },
    { label: t("contact.form.company"), value: companyName },
    { label: t("inspector.field.phone"), value: contact.phone },
    { label: t("inspector.field.linkedin"), value: contact.linkedin },
    { label: t("inspector.field.telegram"), value: contact.telegram },
    { label: t("inspector.field.location"), value: location || null },
    { label: t("contact.temperament"), value: contact.temperament },
    { label: t("contact.valueScore"), value: contact.usefulnessScore != null ? `${contact.usefulnessScore}/10` : null },
  ].filter((f): f is { label: string; value: string } => Boolean(f.value));

  return (
    <div className="flex flex-col gap-5">
      {(contact.valuePotential || contact.needs) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {contact.valuePotential && (
            <div className="rounded-[14px] border border-[#E2F0E9] bg-[#F4FAF7] px-[15px] py-3.5">
              <div className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.09em] text-[#3E8C6E]">
                {t("contact.valuePotential")}
              </div>
              <div className="text-[13.5px] leading-[1.5] text-[#24463A]">{contact.valuePotential}</div>
            </div>
          )}
          {contact.needs && (
            <div className="rounded-[14px] border border-[#EFE6FA] bg-[#FBF6FE] px-[15px] py-3.5">
              <div className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.09em] text-[#7E5FC4]">{t("contact.needs")}</div>
              <div className="text-[13.5px] leading-[1.5] text-[#3B2D63]">{contact.needs}</div>
            </div>
          )}
        </div>
      )}

      {fields.length > 0 && (
        <div>
          <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.09em] text-muted-foreground">{t("contact.fields")}</div>
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.label} className="flex gap-2.5 bg-card px-3 py-2.5">
                <span className="w-20 shrink-0 text-[10.5px] text-muted-foreground">{f.label}</span>
                <span className="min-w-0 truncate text-[12px] font-medium text-foreground">{f.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.09em] text-muted-foreground">{t("contact.summaryNote")}</div>
        <p className="rounded-xl border border-border bg-muted px-3.5 py-3 text-[12.5px] leading-relaxed text-foreground whitespace-pre-wrap">
          {contact.fullSummary || t("contact.summaryEmpty")}
        </p>
      </div>
    </div>
  );
}
