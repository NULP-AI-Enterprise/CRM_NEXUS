"use client";

import { useState, useTransition } from "react";
import { Link2, Loader2, Star, Plus } from "lucide-react";
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
import { RELATIONSHIP_PRESET_KEYS } from "@/lib/contact-display";
import { useTranslation } from "@/lib/i18n/context";

interface ContactOption {
  id: string;
  fullName: string;
  role?: string | null;
  companyName?: string | null;
}

interface AddConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromContact: { id: string; name: string };
  availableContacts: ContactOption[];
  onSuccess?: () => void;
}

export function AddConnectionDialog({
  open,
  onOpenChange,
  fromContact,
  availableContacts,
  onSuccess,
}: AddConnectionDialogProps) {
  const { t } = useTranslation();
  const [toContactId, setToContactId] = useState<string>("");
  const [relationship, setRelationship] = useState<string>(t("relationship.colleague"));
  const [strength, setStrength] = useState<number>(3);
  const [notes, setNotes] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  // Filter out the fromContact itself
  const candidateContacts = availableContacts.filter((c) => c.id !== fromContact.id);

  const handleSubmit = () => {
    if (!toContactId) {
      toast.error(t("connection.selectError"));
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/connections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromContactId: fromContact.id,
            toContactId,
            relationship,
            strength,
            notes: notes.trim() || undefined,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error ?? t("connection.createError"));
        }

        toast.success(t("connection.createSuccess"));
        onOpenChange(false);
        setToContactId("");
        setNotes("");
        onSuccess?.();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("connection.createError"));
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border border-white/[0.08] bg-zinc-900/98 text-foreground backdrop-blur-2xl shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-zinc-300">
            <div className="flex size-7 items-center justify-center rounded-md bg-zinc-800 border border-white/[0.06]">
              <Link2 className="size-3.5" />
            </div>
            <DialogTitle className="text-sm font-semibold text-white">
              {t("connection.title")}
            </DialogTitle>
          </div>
          <DialogDescription className="text-zinc-400 text-xs">{t("connection.description", { name: fromContact.name })}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3.5 py-1 text-xs">
          {/* Target Contact Selector */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-medium text-zinc-300">{t("connection.selectContact")}</Label>
            <select
              value={toContactId}
              onChange={(e) => setToContactId(e.target.value)}
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100 outline-none focus:border-zinc-500"
              disabled={isPending}
            >
              <option value="" disabled>
                {t("connection.selectPlaceholder")}
              </option>
              {candidateContacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName} {c.companyName ? `(${c.companyName})` : ""} {c.role ? `· ${c.role}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Relationship Presets */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-zinc-300">{t("connection.relationshipType")}</Label>
            <div className="flex flex-wrap gap-1">
              {RELATIONSHIP_PRESET_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRelationship(t(key))}
                  className={`rounded px-2 py-0.5 text-xs transition-colors ${
                    relationship === t(key)
                      ? "bg-zinc-100 text-zinc-950 font-medium"
                      : "bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                  }`}
                >
                  {t(key)}
                </button>
              ))}
            </div>
            <Input
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              placeholder={t("connection.relationshipPlaceholder")}
              className="mt-1 bg-zinc-950 border-zinc-800 text-base md:text-xs h-7 rounded-md"
              disabled={isPending}
            />
          </div>

          {/* Strength (1-5) */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-zinc-300">{t("connection.strength")}</Label>
              <span className="text-xs text-zinc-400 font-mono">{strength} / 5</span>
            </div>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setStrength(lvl)}
                  className={`flex flex-1 items-center justify-center gap-1 rounded py-1 text-xs transition-colors ${
                    strength >= lvl
                      ? "bg-zinc-800 border border-zinc-700 text-white font-medium"
                      : "bg-zinc-950 border border-zinc-800 text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <Star className={`size-2.5 ${strength >= lvl ? "fill-zinc-300 text-zinc-300" : ""}`} />
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Optional Notes */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-medium text-zinc-300">{t("connection.notes")}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("connection.notesPlaceholder")}
              className="min-h-14 resize-none bg-zinc-950 border-zinc-800 text-base md:text-xs rounded-md"
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
            disabled={isPending || !toContactId}
            className="bg-white hover:bg-zinc-200 text-zinc-950 gap-1.5 h-7 text-xs font-medium"
          >
            {isPending ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
            {isPending ? t("connection.submitPending") : t("connection.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
