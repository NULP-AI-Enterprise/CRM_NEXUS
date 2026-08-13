"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
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
import { ContactCategory } from "@/generated/prisma/enums";
import type { ContactModel } from "@/generated/prisma/models";

export interface ContactFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies: Array<{ id: string; name: string }>;
  communities?: Array<{ id: string; name: string }>;
  contact?: (ContactModel & { communities?: Array<{ id: string }> }) | null;
  onSuccess?: (contact: ContactModel) => void;
}

const CATEGORIES: ContactCategory[] = ["VIP", "HR", "INVESTOR", "LEAD", "COLLEAGUE", "FRIEND", "OTHER"];

export function ContactFormDialog({
  open,
  onOpenChange,
  companies,
  communities = [],
  contact,
  onSuccess,
}: ContactFormDialogProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const isEditMode = Boolean(contact);

  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [category, setCategory] = useState<ContactCategory>("OTHER");
  const [usefulnessScore, setUsefulnessScore] = useState("");
  const [temperament, setTemperament] = useState("");
  const [needs, setNeeds] = useState("");
  const [valuePotential, setValuePotential] = useState("");
  const [fullSummary, setFullSummary] = useState("");
  const [communityIds, setCommunityIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  // Reset the form from `contact` the moment the dialog transitions from
  // closed to open, adjusting state during render (React's recommended
  // alternative to a setState-in-effect) rather than in a useEffect.
  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) {
    setWasOpen(true);
    setFullName(contact?.fullName ?? "");
    setRole(contact?.role ?? "");
    setCompanyId(contact?.companyId ?? "");
    setCategory(contact?.category ?? "OTHER");
    setUsefulnessScore(contact?.usefulnessScore != null ? String(contact.usefulnessScore) : "");
    setTemperament(contact?.temperament ?? "");
    setNeeds(contact?.needs ?? "");
    setValuePotential(contact?.valuePotential ?? "");
    setFullSummary(contact?.fullSummary ?? "");
    setCommunityIds(contact?.communities?.map((c) => c.id) ?? []);
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  const toggleCommunity = (id: string) => {
    setCommunityIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const handleSubmit = () => {
    if (!fullName.trim()) {
      toast.error(t("contact.form.fullNameRequired"));
      return;
    }

    const payload = {
      fullName: fullName.trim(),
      role: role.trim() || null,
      companyId: companyId || null,
      category,
      usefulnessScore: usefulnessScore ? Number(usefulnessScore) : null,
      temperament: temperament.trim() || null,
      needs: needs.trim() || null,
      valuePotential: valuePotential.trim() || null,
      fullSummary: fullSummary.trim() || null,
      communityIds,
    };

    startTransition(async () => {
      try {
        const res = await fetch(isEditMode ? `/api/contacts/${contact!.id}` : "/api/contacts", {
          method: isEditMode ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error ?? t("common.unknownError"));
        }
        toast.success(isEditMode ? t("contact.form.editSuccess") : t("contact.form.createSuccess"));
        onOpenChange(false);
        onSuccess?.(data.contact);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("common.unknownError"));
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg border border-white/[0.08] bg-zinc-900/98 text-foreground backdrop-blur-2xl shadow-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-zinc-300">
            <div className="flex size-7 items-center justify-center rounded-md bg-zinc-800 border border-white/[0.06]">
              <UserPlus className="size-3.5" />
            </div>
            <DialogTitle className="text-sm font-semibold text-white">
              {isEditMode ? t("contact.form.editTitle") : t("contact.form.createTitle")}
            </DialogTitle>
          </div>
          <DialogDescription className="sr-only">
            {isEditMode ? t("contact.form.editTitle") : t("contact.form.createTitle")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3.5 py-1 text-xs">
          <div className="grid gap-3.5 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-zinc-300">{t("contact.form.fullName")}</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t("contact.form.fullNamePlaceholder")}
                className="bg-zinc-950 border-zinc-800 text-base md:text-xs h-8 rounded-md"
                disabled={isPending}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-zinc-300">{t("contact.form.role")}</Label>
              <Input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder={t("contact.form.rolePlaceholder")}
                className="bg-zinc-950 border-zinc-800 text-base md:text-xs h-8 rounded-md"
                disabled={isPending}
              />
            </div>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-zinc-300">{t("contact.form.company")}</Label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100 outline-none focus:border-zinc-500 h-8"
                disabled={isPending}
              >
                <option value="">{t("contact.form.companyNone")}</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-zinc-300">{t("contact.form.category")}</Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ContactCategory)}
                className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100 outline-none focus:border-zinc-500 h-8"
                disabled={isPending}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {t(`category.${cat}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-zinc-300">{t("contact.form.communities")}</Label>
            {communities.length === 0 ? (
              <p className="text-[11px] text-zinc-500">{t("contact.form.communitiesEmpty")}</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {communities.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCommunity(c.id)}
                    disabled={isPending}
                    className={`rounded px-2 py-0.5 text-xs transition-colors ${
                      communityIds.includes(c.id)
                        ? "bg-zinc-100 text-zinc-950 font-medium"
                        : "bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-zinc-300">{t("contact.form.usefulnessScore")}</Label>
              <span className="text-xs text-zinc-400 font-mono">{usefulnessScore || "—"}</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={usefulnessScore || 0}
              onChange={(e) => setUsefulnessScore(e.target.value)}
              className="w-full accent-white h-1 bg-zinc-800 rounded"
              disabled={isPending}
            />
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-zinc-300">{t("contact.form.temperament")}</Label>
              <Textarea
                value={temperament}
                onChange={(e) => setTemperament(e.target.value)}
                className="min-h-14 resize-none bg-zinc-950 border-zinc-800 text-base md:text-xs rounded-md"
                disabled={isPending}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-zinc-300">{t("contact.form.needs")}</Label>
              <Textarea
                value={needs}
                onChange={(e) => setNeeds(e.target.value)}
                className="min-h-14 resize-none bg-zinc-950 border-zinc-800 text-base md:text-xs rounded-md"
                disabled={isPending}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs font-medium text-zinc-300">{t("contact.form.valuePotential")}</Label>
            <Textarea
              value={valuePotential}
              onChange={(e) => setValuePotential(e.target.value)}
              className="min-h-14 resize-none bg-zinc-950 border-zinc-800 text-base md:text-xs rounded-md"
              disabled={isPending}
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs font-medium text-zinc-300">{t("contact.form.fullSummary")}</Label>
            <Textarea
              value={fullSummary}
              onChange={(e) => setFullSummary(e.target.value)}
              className="min-h-16 resize-none bg-zinc-950 border-zinc-800 text-base md:text-xs rounded-md"
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
            disabled={isPending || !fullName.trim()}
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
