"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/context";

export interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  description: string;
  onConfirm: () => Promise<void>;
}

export function ConfirmDeleteDialog({ open, onOpenChange, description, onConfirm }: ConfirmDeleteDialogProps) {
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      await onConfirm();
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm border border-border bg-card text-foreground backdrop-blur-2xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold text-foreground">{t("common.confirmDeleteTitle")}</DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="border-t border-border pt-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="border-border bg-card text-muted-foreground hover:bg-muted h-7 text-xs"
          >
            {t("common.cancel")}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleConfirm}
            disabled={isPending}
            className="h-7 text-xs gap-1.5"
          >
            {isPending && <Loader2 className="size-3 animate-spin" />}
            {isPending ? t("common.deleting") : t("common.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
