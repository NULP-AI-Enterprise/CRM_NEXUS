"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { CATEGORY_COLORS, initials } from "@/lib/contact-display";
import { useTranslation } from "@/lib/i18n/context";
import type { ContactModel } from "@/generated/prisma/models";

export function ContactCard({ contact }: { contact: ContactModel }) {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = CATEGORY_COLORS[contact.category] || CATEGORY_COLORS.OTHER;
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const location = [contact.city, contact.country].filter(Boolean).join(", ");

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(t("common.unknownError"));
      toast.success(t("contact.delete.success"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.unknownError"));
    }
  };

  return (
    <div
      className="group relative rounded-[16px] border border-border bg-card px-4 pt-[15px] pb-[14px] transition-shadow"
      style={{ borderLeftWidth: "3px", borderLeftColor: colors.dot }}
    >
      <Link href={`/contacts/${contact.id}`} className="absolute inset-0" aria-label={contact.fullName} />

      <div className="flex items-start gap-[11px]">
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-[12.5px] font-semibold"
          style={{ backgroundColor: colors.bg, color: colors.text }}
        >
          {initials(contact.fullName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold leading-[1.25] tracking-[-0.2px] text-foreground">
            {contact.fullName}
          </p>
          <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
            {contact.role ?? "—"}
            {contact.companyName && ` · ${contact.companyName}`}
          </p>
        </div>
        {contact.usefulnessScore != null && (
          <span
            className="shrink-0 rounded-[20px] px-[7px] py-[3px] font-mono text-[10.5px] font-medium"
            style={{ backgroundColor: colors.bg, color: colors.text }}
          >
            {contact.usefulnessScore}/10
          </span>
        )}
      </div>

      {(contact.valuePotential || contact.needs) && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {contact.valuePotential && (
            <div className="rounded-[10px] border border-[#E2F0E9] bg-[#F4FAF7] px-[9px] py-2">
              <div className="mb-1 font-mono text-[8.5px] uppercase tracking-[0.08em] text-[#3E8C6E]">
                {t("contact.valuePotential")}
              </div>
              <div className="text-[11.5px] leading-[1.35] text-[#2B4A3E]">{contact.valuePotential}</div>
            </div>
          )}
          {contact.needs && (
            <div className="rounded-[10px] border border-[#EFE6FA] bg-[#FBF6FE] px-[9px] py-2">
              <div className="mb-1 font-mono text-[8.5px] uppercase tracking-[0.08em] text-[#7E5FC4]">
                {t("contact.needs")}
              </div>
              <div className="text-[11.5px] leading-[1.35] text-[#41326B]">{contact.needs}</div>
            </div>
          )}
        </div>
      )}

      <div className="mt-[11px] flex flex-wrap items-center gap-1.5">
        {contact.temperament && (
          <span className="rounded-[20px] bg-muted px-2 py-[3px] text-[10.5px] text-muted-foreground">
            {contact.temperament}
          </span>
        )}
        {location && (
          <span className="rounded-[20px] bg-muted px-2 py-[3px] text-[10.5px] text-muted-foreground">{location}</span>
        )}
        <span className="rounded-[20px] bg-muted px-2 py-[3px] text-[10.5px] text-muted-foreground">
          {t(`category.${contact.category}`)}
        </span>

        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDeleteOpen(true);
          }}
          title={t("common.delete")}
          className="relative z-10 ml-auto rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive hover:bg-muted group-hover:opacity-100 group-focus-within:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
      </div>

      <ConfirmDeleteDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        description={t("contact.delete.confirm", { name: contact.fullName })}
        onConfirm={handleDelete}
      />
    </div>
  );
}
