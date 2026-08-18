"use client";

import { Pencil, Trash2, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/context";

export function EntityCardShell({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("group relative rounded-xl border border-border bg-card transition-colors hover:border-accent/40", className)}>
      {children}
    </div>
  );
}

export function EntityIconBadge({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return (
    <div className={cn("flex size-6 items-center justify-center rounded-md bg-secondary text-muted-foreground", className)}>
      <Icon className="size-3.5" />
    </div>
  );
}

interface EntityCardActionsProps {
  onEdit?: () => void;
  onDelete?: () => void;
  showLabels?: boolean;
  className?: string;
}

export function EntityCardActions({ onEdit, onDelete, showLabels = false, className }: EntityCardActionsProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100",
        className,
      )}
    >
      {onEdit && (
        <button
          onClick={onEdit}
          title={t("common.edit")}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Pencil className="size-3" />
          {showLabels && t("common.edit")}
        </button>
      )}
      {onDelete && (
        <button
          onClick={onDelete}
          title={t("common.delete")}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
        >
          <Trash2 className="size-3" />
          {showLabels && t("common.delete")}
        </button>
      )}
    </div>
  );
}
