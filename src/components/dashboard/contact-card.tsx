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
      className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-zinc-900/30 p-3 transition-colors hover:border-white/[0.12] hover:bg-zinc-900/70"
    >
      <Avatar className="size-8.5 border border-white/[0.08] shrink-0 bg-zinc-800">
        <AvatarFallback className="text-[11px] font-medium text-zinc-300 bg-zinc-800/90">
          {initials(contact.fullName)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-xs font-medium text-zinc-100 group-hover:text-white transition-colors">
            {contact.fullName}
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-400 font-normal shrink-0">
            <span
              className="size-1.5 rounded-full"
              style={{ backgroundColor: colors.dot }}
            />
            {t(`category.${contact.category}`)}
          </span>
        </div>

        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-400">
          <span className="truncate">{contact.role ?? "—"}</span>
          {contact.companyName && (
            <>
              <span className="text-zinc-600">•</span>
              <span className="truncate text-zinc-300">{contact.companyName}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {contact.usefulnessScore != null && (
          <span className="flex items-center gap-1 rounded border border-white/[0.06] bg-zinc-900/60 px-1.5 py-0.5 text-[10px] font-mono text-zinc-300">
            <Star className="size-2.5 text-zinc-500 fill-zinc-500" />
            {contact.usefulnessScore}
          </span>
        )}
        <ChevronRight className="size-3.5 text-zinc-600 group-hover:text-zinc-300 transition-colors" />
      </div>
    </Link>
  );
}
