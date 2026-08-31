"use client";

import { useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

/** Click-to-edit text field: shows the value as plain text, swaps to an
 * input/textarea on click, saves on blur or Enter (multiline: blur only —
 * Enter inserts a newline), reverts on Escape. No separate "Save" step and
 * no modal — editing happens directly where the value is already displayed,
 * matching every other read-only "FIELDS" cell it sits alongside. */
export function EditableField({
  value,
  placeholder,
  multiline = false,
  onSave,
  className,
  inputClassName,
}: {
  value: string;
  placeholder: string;
  multiline?: boolean;
  onSave: (value: string) => Promise<void>;
  className?: string;
  inputClassName?: string;
}) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const skipNextBlur = useRef(false);

  const startEditing = () => {
    setDraft(value);
    setIsEditing(true);
  };

  const cancel = () => {
    setDraft(value);
    setIsEditing(false);
  };

  const commit = async () => {
    const trimmed = draft.trim();
    if (trimmed === (value ?? "").trim()) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      await onSave(trimmed);
      setIsEditing(false);
    } catch {
      toast.error(t("common.unknownError"));
      setDraft(value);
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
    const Field = multiline ? Textarea : Input;
    return (
      <Field
        autoFocus
        value={draft}
        disabled={isSaving}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => {
          const el = e.target;
          el.setSelectionRange(el.value.length, el.value.length);
        }}
        onBlur={() => {
          if (skipNextBlur.current) {
            skipNextBlur.current = false;
            return;
          }
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !multiline) {
            e.preventDefault();
            // Committing disables the input (isSaving), which forces a
            // browser blur on it — without this guard, that blur's own
            // onBlur handler would fire a second, redundant commit() with
            // the same value right behind this one.
            skipNextBlur.current = true;
            commit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            skipNextBlur.current = true;
            cancel();
          }
        }}
        placeholder={placeholder}
        className={cn("text-[12px]", multiline && "min-h-16 resize-none", inputClassName)}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      title={value || undefined}
      className={cn(
        "group flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-0.5 text-left transition-colors hover:bg-muted",
        className,
      )}
    >
      {/* A long value (a role title, a full address) can genuinely need more
          width than a fixed-label grid cell has — truncate is correct CSS,
          not a bug, but with no way to see what got cut off. The title
          attribute gives a hover tooltip with the full value; multiline
          fields wrap instead of truncating, since a note is meant to be read
          in full, not skimmed as a one-liner. */}
      <span className={cn("min-w-0 flex-1", multiline ? "line-clamp-2 whitespace-pre-wrap" : "truncate", value ? "text-foreground" : "text-muted-foreground")}>
        {value || placeholder}
      </span>
      <Pencil className="size-2.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}
