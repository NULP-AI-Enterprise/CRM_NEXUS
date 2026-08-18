"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Star, Trash2, Pencil, MapPin, Phone, Link2, Send, Camera, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

  return (
    <div className="relative border-b border-border p-5" style={{ backgroundColor: colors.bg }}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <Avatar className="size-14 border border-border bg-secondary shrink-0">
            <AvatarFallback className="text-sm font-medium bg-secondary text-secondary-foreground">
              {initials(contact.fullName)}
            </AvatarFallback>
          </Avatar>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-xl font-semibold text-foreground tracking-tight">{contact.fullName}</h1>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                <span
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: colors.dot }}
                />
                {t(`category.${contact.category}`)}
              </span>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
              {contact.role && <span>{contact.role}</span>}
              {contact.company && (
                <>
                  <span className="text-muted-foreground/60">•</span>
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Building2 className="size-3 text-muted-foreground" />
                    {contact.company.name}
                  </Link>
                </>
              )}
              {(contact.city || contact.country) && (
                <>
                  <span className="text-muted-foreground/60">•</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3 text-muted-foreground" />
                    {[contact.city, contact.country].filter(Boolean).join(", ")}
                  </span>
                </>
              )}
            </div>

            {(contact.phone || contact.linkedin || contact.telegram || contact.instagram || contact.whatsapp) && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {contact.phone && (
                  <a
                    href={`tel:${contact.phone}`}
                    title={t("contact.form.phone")}
                    className="flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    <Phone className="size-3" />
                    {contact.phone}
                  </a>
                )}
                {contact.linkedin && (
                  <a
                    href={linkedinUrl(contact.linkedin)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={t("contact.form.linkedin")}
                    className="flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    <Link2 className="size-3" />
                    LinkedIn
                  </a>
                )}
                {contact.telegram && (
                  <a
                    href={telegramUrl(contact.telegram)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Telegram"
                    className="flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    <Send className="size-3" />
                    Telegram
                  </a>
                )}
                {contact.instagram && (
                  <a
                    href={instagramUrl(contact.instagram)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Instagram"
                    className="flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    <Camera className="size-3" />
                    Instagram
                  </a>
                )}
                {contact.whatsapp && (
                  <a
                    href={whatsappUrl(contact.whatsapp)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="WhatsApp"
                    className="flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    <MessageCircle className="size-3" />
                    WhatsApp
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {contact.usefulnessScore != null && (
            <div className="flex items-center gap-2 rounded-lg bg-card border border-border px-3 py-1.5 text-foreground">
              <Star className="size-4 text-accent" />
              <div>
                <div className="text-[10px] uppercase text-muted-foreground font-medium">{t("contact.valueScore")}</div>
                <div className="text-sm font-semibold font-mono text-foreground leading-tight">
                  {contact.usefulnessScore} / 10
                </div>
              </div>
            </div>
          )}
          <Link
            href={`/network?focus=${contact.id}`}
            className="flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Share2 className="size-3.5" />
            {t("contact.viewInGraph")}
          </Link>
          <Button
            size="icon"
            variant="outline"
            onClick={() => setIsEditOpen(true)}
            className="size-8 border-border bg-card text-muted-foreground hover:text-foreground"
            title={t("common.edit")}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={() => setIsDeleteOpen(true)}
            className="size-8 border-border bg-card text-muted-foreground hover:text-destructive"
            title={t("common.delete")}
          >
            <Trash2 className="size-3.5" />
          </Button>
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
