"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/lib/i18n/context";
import type { CompanyModel } from "@/generated/prisma/models";

export interface CompanyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company?: CompanyModel | null;
  onSuccess?: (company: CompanyModel) => void;
}

export function CompanyFormDialog({ open, onOpenChange, company, onSuccess }: CompanyFormDialogProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const isEditMode = Boolean(company);

  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [description, setDescription] = useState("");
  const [isPending, startTransition] = useTransition();

  // Reset the form from `company` the moment the dialog transitions from
  // closed to open, adjusting state during render (React's recommended
  // alternative to a setState-in-effect) rather than in a useEffect.
  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) {
    setWasOpen(true);
    setName(company?.name ?? "");
    setIndustry(company?.industry ?? "");
    setDescription(company?.description ?? "");
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error(t("company.form.nameRequired"));
      return;
    }

    const payload = {
      name: name.trim(),
      industry: industry.trim() || null,
      description: description.trim() || null,
    };

    startTransition(async () => {
      try {
        const res = await fetch(isEditMode ? `/api/companies/${company!.id}` : "/api/companies", {
          method: isEditMode ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error === "duplicate" ? t("company.form.duplicateName") : (data?.error ?? t("common.unknownError")));
        }
        toast.success(isEditMode ? t("company.form.editSuccess") : t("company.form.createSuccess"));
        onOpenChange(false);
        onSuccess?.(data.company);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("common.unknownError"));
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border border-white/[0.08] bg-zinc-900/98 text-foreground backdrop-blur-2xl shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-zinc-300">
            <div className="flex size-7 items-center justify-center rounded-md bg-zinc-800 border border-white/[0.06]">
              <Building2 className="size-3.5" />
            </div>
            <DialogTitle className="text-sm font-semibold text-white">
              {isEditMode ? t("company.form.editTitle") : t("company.form.createTitle")}
            </DialogTitle>
          </div>
          <DialogDescription className="sr-only">
            {isEditMode ? t("company.form.editTitle") : t("company.form.createTitle")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3.5 py-1 text-xs">
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-medium text-zinc-300">{t("company.form.name")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("company.form.namePlaceholder")}
              className="bg-zinc-950 border-zinc-800 text-xs h-8 rounded-md"
              disabled={isPending}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-medium text-zinc-300">{t("company.form.industry")}</Label>
            <Input
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder={t("company.form.industryPlaceholder")}
              className="bg-zinc-950 border-zinc-800 text-xs h-8 rounded-md"
              disabled={isPending}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-medium text-zinc-300">{t("company.form.description")}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("company.form.descriptionPlaceholder")}
              className="min-h-16 resize-none bg-zinc-950 border-zinc-800 text-xs rounded-md"
              disabled={isPending}
            />
          </div>
        </div>

        <DialogFooter className="border-t border-white/[0.06] pt-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 h-7 text-xs"
          >
            {t("common.cancel")}
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isPending || !name.trim()}
            className="bg-white hover:bg-zinc-200 text-zinc-950 gap-1.5 h-7 text-xs font-medium"
          >
            {isPending && <Loader2 className="size-3 animate-spin" />}
            {isPending ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
