"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { EditableField } from "@/components/ui/editable-field";
import { useTranslation } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

const cellClass = "flex items-center gap-2.5 bg-card px-3 py-2.5";
const labelClass = "w-20 shrink-0 text-[10.5px] text-muted-foreground";

interface OrgFieldsData {
  id: string;
  /** Company only — omit entirely (not just null) for Community, which has
   * no equivalent column. */
  industry?: string | null;
  description: string | null;
  linkedin: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  usefulnessScore: number | null;
  needs: string | null;
  valuePotential: string | null;
  fullSummary: string | null;
}

/** Shared field grid for Company and Community — same shape as
 * ContactProfileBody, minus the contact-specific fields (role, category,
 * temperament, communities) that don't apply to an organization. One
 * component instead of two near-duplicates, parameterized only by which
 * PATCH endpoint to hit and whether an `industry` row applies. */
export function OrgFieldsSection({ data, patchUrl }: { data: OrgFieldsData; patchUrl: string }) {
  const { t } = useTranslation();
  const router = useRouter();

  const patch = async (body: Record<string, unknown>) => {
    const res = await fetch(patchUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error();
    router.refresh();
  };
  const saveText = (field: string) => (value: string) => patch({ [field]: value || null });

  const [score, setScore] = useState(data.usefulnessScore ?? 5);
  const [isSavingScore, setIsSavingScore] = useState(false);
  const commitScore = async (next: number) => {
    setIsSavingScore(true);
    try {
      await patch({ usefulnessScore: next });
    } catch {
      toast.error(t("common.unknownError"));
      setScore(data.usefulnessScore ?? 5);
    } finally {
      setIsSavingScore(false);
    }
  };

  const fields: Array<{ key: string; label: string; value: string | null }> = [
    ...(data.industry !== undefined ? [{ key: "industry", label: t("company.form.industry"), value: data.industry }] : []),
    { key: "description", label: t("company.form.description"), value: data.description },
    { key: "linkedin", label: t("inspector.field.linkedin"), value: data.linkedin },
    { key: "phone", label: t("inspector.field.phone"), value: data.phone },
    { key: "city", label: t("inspector.field.city"), value: data.city },
    { key: "country", label: t("inspector.field.country"), value: data.country },
  ];
  // The value-score row is always last — span both columns when it would
  // otherwise be the odd one out with an empty cell beside it.
  const scoreSpans = (fields.length + 1) % 2 !== 0;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground">{t("contact.fields")}</div>
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[14px] border border-border bg-border sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.key} className={cellClass}>
              <span className={labelClass}>{f.label}</span>
              <EditableField value={f.value ?? ""} placeholder="—" onSave={saveText(f.key)} />
            </div>
          ))}
          <div className={cn(cellClass, scoreSpans && "sm:col-span-2")}>
            <span className={labelClass}>{t("contact.valueScore")}</span>
            <div className="flex flex-1 items-center gap-2">
              <input
                type="range"
                min={1}
                max={10}
                value={score}
                disabled={isSavingScore}
                onChange={(e) => setScore(Number(e.target.value))}
                onPointerUp={(e) => commitScore(Number((e.target as HTMLInputElement).value))}
                onKeyUp={(e) => commitScore(Number((e.target as HTMLInputElement).value))}
                className="h-1 flex-1 accent-primary disabled:opacity-50"
              />
              <span className="w-9 shrink-0 font-mono text-[11px] text-foreground">{score}/10</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[14px] border border-[#E2F0E9] bg-[#F4FAF7] px-[15px] py-3.5">
          <div className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.09em] text-[#3E8C6E]">{t("contact.valuePotential")}</div>
          <EditableField
            value={data.valuePotential ?? ""}
            placeholder="—"
            multiline
            onSave={saveText("valuePotential")}
            className="text-[13.5px] leading-[1.5] text-[#24463A] hover:bg-[#E2F0E9]/60"
          />
        </div>
        <div className="rounded-[14px] border border-[#EFE6FA] bg-[#FBF6FE] px-[15px] py-3.5">
          <div className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.09em] text-[#7E5FC4]">{t("contact.needs")}</div>
          <EditableField
            value={data.needs ?? ""}
            placeholder="—"
            multiline
            onSave={saveText("needs")}
            className="text-[13.5px] leading-[1.5] text-[#3B2D63] hover:bg-[#EFE6FA]/60"
          />
        </div>
      </div>

      <div>
        <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.09em] text-muted-foreground">{t("contact.summaryNote")}</div>
        <div className="rounded-[14px] border border-border bg-muted px-3.5 py-3">
          <EditableField
            value={data.fullSummary ?? ""}
            placeholder={t("org.summaryEmpty")}
            multiline
            onSave={saveText("fullSummary")}
            className="text-[12.5px] leading-relaxed text-foreground"
          />
        </div>
      </div>
    </div>
  );
}
