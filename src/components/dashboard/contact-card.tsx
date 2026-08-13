"use client";

import Link from "next/link";
import { Star, ChevronRight } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CATEGORY_COLORS, initials } from "@/lib/contact-display";
import { useTranslation } from "@/lib/i18n/context";
import type { ContactModel } from "@/generated/prisma/models";

export function ContactCard({ contact }: { contact: ContactModel }) {
  const { t } = useTranslation();
  const colors = CATEGORY_COLORS[contact.category] || CATEGORY_COLORS.OTHER;

  return (
    <Link
      href={`/contacts/${contact.id}`}
      className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-accent/40 hover:bg-muted"
    >
      <Avatar className="size-8.5 border border-border shrink-0 bg-secondary">
        <AvatarFallback className="text-[11px] font-medium text-muted-foreground bg-secondary">
          {initials(contact.fullName)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-xs font-medium text-foreground group-hover:text-foreground transition-colors">
            {contact.fullName}
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground font-normal shrink-0">
            <span
              className="size-1.5 rounded-full"
              style={{ backgroundColor: colors.dot }}
            />
            {t(`category.${contact.category}`)}
          </span>
        </div>

        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="truncate">{contact.role ?? "—"}</span>
          {contact.companyName && (
            <>
              <span className="text-muted-foreground">•</span>
              <span className="truncate text-foreground">{contact.companyName}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {contact.usefulnessScore != null && (
          <span className="flex items-center gap-1 rounded border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            <Star className="size-2.5 text-muted-foreground fill-muted-foreground" />
            {contact.usefulnessScore}
          </span>
        )}
        <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
      </div>
    </Link>
  );
}
