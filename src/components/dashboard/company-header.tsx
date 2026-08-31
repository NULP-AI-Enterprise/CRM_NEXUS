"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { EditableField } from "@/components/ui/editable-field";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { useTranslation } from "@/lib/i18n/context";
import type { CompanyModel } from "@/generated/prisma/models";

export function CompanyHeader({ company }: { company: CompanyModel }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/companies/${company.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(t("common.unknownError"));
      toast.success(t("company.delete.success"));
      router.push("/companies");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.unknownError"));
    }
  };

  const saveName = async (value: string) => {
    if (!value.trim()) throw new Error();
    const res = await fetch(`/api/companies/${company.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: value }),
    });
    if (!res.ok) throw new Error();
    router.refresh();
  };

  return (
    <div className="relative flex flex-wrap items-start justify-between gap-3 border-b border-[#f1f0ec] px-[22px] py-5" style={{ backgroundColor: "#E8F6F0" }}>
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-[52px] flex-none items-center justify-center rounded-full bg-white">
          <Building2 className="size-5" style={{ color: "#1F6349" }} />
        </div>
        <div className="min-w-0">
          <EditableField
            value={company.name}
            placeholder={t("company.form.namePlaceholder")}
            onSave={saveName}
            className="px-0"
            inputClassName="h-auto py-0 font-heading text-[25px] font-semibold tracking-[-0.6px] text-foreground"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsDeleteOpen(true)}
          title={t("common.delete")}
          className="flex size-[34px] items-center justify-center rounded-[9px] border border-[#e4e3de] bg-white text-[#9a9a94] transition-colors hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <ConfirmDeleteDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        description={t("company.delete.confirm", { name: company.name })}
        onConfirm={handleDelete}
      />
    </div>
  );
}
