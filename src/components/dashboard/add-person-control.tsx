"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { useTranslation } from "@/lib/i18n/context";

/** "+ Add person" for a Company/Community page's member list — picks from the
 * user's other contacts (already filtered to exclude current members by the
 * caller) and hands the chosen id to `onAdd`, which does the actual
 * company/community-specific mutation (a company assigns companyId directly;
 * a community connects via its own members endpoint). */
export function AddPersonControl({
  contacts,
  onAdd,
}: {
  contacts: Array<{ id: string; fullName: string }>;
  onAdd: (contactId: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handlePick = async (contactId: string) => {
    if (!contactId) return;
    setIsSaving(true);
    try {
      await onAdd(contactId);
      setIsOpen(false);
      router.refresh();
    } catch {
      toast.error(t("common.unknownError"));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={contacts.length === 0 || isSaving}
        className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus className="size-3" />
        {t("org.addPerson")}
      </button>
    );
  }

  return (
    <select
      autoFocus
      disabled={isSaving}
      defaultValue=""
      onChange={(e) => handlePick(e.target.value)}
      onBlur={() => setIsOpen(false)}
      className="rounded-md border border-input bg-transparent px-2 py-1 text-[11px] outline-none disabled:opacity-50"
    >
      <option value="" disabled>
        {t("org.addPersonPlaceholder")}
      </option>
      {contacts.map((c) => (
        <option key={c.id} value={c.id}>
          {c.fullName}
        </option>
      ))}
    </select>
  );
}
