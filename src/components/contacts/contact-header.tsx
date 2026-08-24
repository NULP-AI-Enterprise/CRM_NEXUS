"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, MapPin, Phone, Link2, Send, Camera, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { CATEGORY_COLORS, initials, linkedinUrl, telegramUrl, instagramUrl, whatsappUrl } from "@/lib/contact-display";
import { useTranslation } from "@/lib/i18n/context";
import type { CompanyModel, ContactModel } from "@/generated/prisma/models";
import { ContactFormDialog } from "@/components/contacts/contact-form-dialog";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";

type ContactHeaderType = ContactModel & {
  company: CompanyModel | null;
  communities?: Array<{ id: string; name: string }>;
};

export function ContactHeader({
  contact,
  companies,
  communities = [],
}: {
  contact: ContactHeaderType;
  companies: Array<{ id: string; name: string }>;
  communities?: Array<{ id: string; name: string }>;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const colors = CATEGORY_COLORS[contact.category] || CATEGORY_COLORS.OTHER;

  const handleDeleteContact = async () => {
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(t("common.unknownError"));
      toast.success(t("contact.delete.success"));
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.unknownError"));
    }
  };

  const location = [contact.city, contact.country].filter(Boolean).join(", ");

  // Social links become chips in the identity band, matching the template's
  // pill row. Each keeps its original destination and semantics.
  const socialChips = [
    contact.phone && { key: "phone", href: `tel:${contact.phone}`, icon: Phone, label: contact.phone, ext: false },
    contact.linkedin && { key: "linkedin", href: linkedinUrl(contact.linkedin), icon: Link2, label: "LinkedIn", ext: true },
    contact.telegram && { key: "telegram", href: telegramUrl(contact.telegram), icon: Send, label: "Telegram", ext: true },
    contact.instagram && { key: "instagram", href: instagramUrl(contact.instagram), icon: Camera, label: "Instagram", ext: true },
    contact.whatsapp && { key: "whatsapp", href: whatsappUrl(contact.whatsapp), icon: MessageCircle, label: "WhatsApp", ext: true },
  ].filter(Boolean) as Array<{ key: string; href: string; icon: typeof Phone; label: string; ext: boolean }>;

  const chipClass =
    "flex items-center gap-1 rounded-[20px] border border-[rgba(27,29,33,0.07)] bg-white px-[9px] py-[4px] text-[11px] text-[#3a3c42] transition-colors hover:border-[rgba(27,29,33,0.16)]";

  return (
    <div
      className="relative flex flex-wrap items-start gap-x-4 gap-y-3 border-b border-[#f1f0ec] px-[22px] py-5"
      style={{ backgroundColor: colors.bg }}
    >
      {/* Avatar + identity in one flex unit so the action row wraps as a whole */}
      <div className="flex min-w-0 flex-1 basis-[200px] items-start gap-4">
        {/* Identity glyph — white tile inked with the category colour */}
        <div
          className="flex size-[52px] flex-none items-center justify-center rounded-full bg-white text-[16px] font-semibold"
          style={{ color: colors.text }}
        >
          {initials(contact.fullName)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-[9px] gap-y-1">
            <span
              className="kicker flex items-center gap-1.5 rounded-[5px] bg-white px-2 py-[3px]"
              style={{ fontSize: "9.5px", color: colors.text }}
            >
              <span className="size-1.5 rounded-full" style={{ backgroundColor: colors.dot }} />
              {t(`category.${contact.category}`)}
            </span>
            {(contact.role || contact.company) && (
              <span className="text-[11.5px] text-[#6e7480]">
                {contact.role}
                {contact.role && contact.company && " · "}
                {contact.company?.name}
              </span>
            )}
          </div>

          <h1 className="mt-[7px] font-heading text-[25px] font-semibold tracking-[-0.6px] text-foreground">
            {contact.fullName}
          </h1>

          <div className="mt-2.5 flex flex-wrap items-center gap-[7px]">
            {location && (
              <span className={chipClass}>
                <MapPin className="size-3 text-[#8c8c86]" />
                {location}
              </span>
            )}
            {contact.usefulnessScore != null && (
              <span className={chipClass}>
                <span className="font-mono text-[10.5px]">{contact.usefulnessScore}/10</span>
                <span className="text-[#8c8c86]">{t("contact.valueScore")}</span>
              </span>
            )}
            {socialChips.map((s) => {
              const Icon = s.icon;
              return (
                <a
                  key={s.key}
                  href={s.href}
                  {...(s.ext ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className={chipClass}
                >
                  <Icon className="size-3 text-[#8c8c86]" />
                  {s.label}
                </a>
              );
            })}
          </div>
        </div>
      </div>

      {/* Action buttons — on mobile they wrap below identity (basis-full) and
          become a horizontal row; on sm+ they stack vertically on the right */}
      <div className="flex w-full items-center gap-2 sm:w-auto sm:flex-col sm:items-end">
        <Link
          href={`/network?focus=${contact.id}`}
          className="whitespace-nowrap rounded-[9px] bg-[#1b1d21] px-[13px] py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[#33363d]"
        >
          {t("contact.viewInGraph")} →
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditOpen(true)}
            className="rounded-[9px] border border-[#e4e3de] bg-white px-[13px] py-2 text-[12px] font-semibold text-foreground transition-colors hover:border-[#c9c8c2]"
          >
            {t("common.edit")}
          </button>
          <button
            onClick={() => setIsDeleteOpen(true)}
            title={t("common.delete")}
            className="flex size-[34px] items-center justify-center rounded-[9px] border border-[#e4e3de] bg-white text-[#9a9a94] transition-colors hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      <ContactFormDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        companies={companies}
        communities={communities}
        contact={contact}
      />

      <ConfirmDeleteDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        description={t("contact.delete.confirm", { name: contact.fullName })}
        onConfirm={handleDeleteContact}
      />
    </div>
  );
}
