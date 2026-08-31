"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { EditableField } from "@/components/ui/editable-field";
import { useTranslation } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";
import type { CompanyModel, ContactModel } from "@/generated/prisma/models";

type ContactWithCompany = ContactModel & {
  company?: CompanyModel | null;
  communities?: Array<{ id: string; name: string }>;
};

const cellClass = "flex items-center gap-2.5 bg-card px-3 py-2.5";
const labelClass = "w-20 shrink-0 text-[10.5px] text-muted-foreground";

/** Every field lives directly in this grid now — click a value, edit it,
 * it saves itself on blur. Replaces the old "Edit" button + modal dialog:
 * the same information was already displayed here, so there's no reason
 * editing it should happen anywhere else. */
export function ContactProfileBody({
  contact,
  companies,
  communities = [],
}: {
  contact: ContactWithCompany;
  companies: Array<{ id: string; name: string }>;
  communities?: Array<{ id: string; name: string }>;
}) {
  const { t } = useTranslation();
  const router = useRouter();

  const patch = async (data: Record<string, unknown>) => {
    const res = await fetch(`/api/contacts/${contact.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error();
    router.refresh();
  };

  const [companyId, setCompanyId] = useState(contact.companyId ?? "");
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  const handleCompanyChange = async (next: string) => {
    const prev = companyId;
    setCompanyId(next);
    setIsSavingCompany(true);
    try {
      await patch({ companyId: next || null });
    } catch {
      toast.error(t("common.unknownError"));
      setCompanyId(prev);
    } finally {
      setIsSavingCompany(false);
    }
  };

  const [score, setScore] = useState(contact.usefulnessScore ?? 5);
  const [isSavingScore, setIsSavingScore] = useState(false);
  const commitScore = async (next: number) => {
    setIsSavingScore(true);
    try {
      await patch({ usefulnessScore: next });
    } catch {
      toast.error(t("common.unknownError"));
      setScore(contact.usefulnessScore ?? 5);
    } finally {
      setIsSavingScore(false);
    }
  };

  const [communityIds, setCommunityIds] = useState<string[]>((contact.communities ?? []).map((c) => c.id));
  const [isSavingCommunities, setIsSavingCommunities] = useState(false);
  const toggleCommunity = async (id: string) => {
    if (isSavingCommunities) return;
    const prev = communityIds;
    const next = prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id];
    setCommunityIds(next);
    setIsSavingCommunities(true);
    try {
      await patch({ communityIds: next });
    } catch {
      toast.error(t("common.unknownError"));
      setCommunityIds(prev);
    } finally {
      setIsSavingCommunities(false);
    }
  };

  const saveText = (field: string) => (value: string) => patch({ [field]: value || null });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.09em] text-muted-foreground">{t("contact.fields")}</div>
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[14px] border border-border bg-border sm:grid-cols-2">
          <div className={cellClass}>
            <span className={labelClass}>{t("contact.form.role")}</span>
            <EditableField value={contact.role ?? ""} placeholder="—" onSave={saveText("role")} />
          </div>
          <div className={cellClass}>
            <span className={labelClass}>{t("contact.form.company")}</span>
            <select
              value={companyId}
              disabled={isSavingCompany}
              onChange={(e) => handleCompanyChange(e.target.value)}
              className="min-w-0 flex-1 truncate rounded bg-transparent text-[12px] font-medium text-foreground outline-none disabled:opacity-50"
            >
              <option value="">{t("contact.form.companyNone")}</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className={cellClass}>
            <span className={labelClass}>{t("inspector.field.phone")}</span>
            <EditableField value={contact.phone ?? ""} placeholder="—" onSave={saveText("phone")} />
          </div>
          <div className={cellClass}>
            <span className={labelClass}>{t("inspector.field.linkedin")}</span>
            <EditableField value={contact.linkedin ?? ""} placeholder="—" onSave={saveText("linkedin")} />
          </div>
          <div className={cellClass}>
            <span className={labelClass}>{t("inspector.field.telegram")}</span>
            <EditableField value={contact.telegram ?? ""} placeholder="—" onSave={saveText("telegram")} />
          </div>
          <div className={cellClass}>
            <span className={labelClass}>{t("inspector.field.instagram")}</span>
            <EditableField value={contact.instagram ?? ""} placeholder="—" onSave={saveText("instagram")} />
          </div>
          <div className={cellClass}>
            <span className={labelClass}>{t("inspector.field.whatsapp")}</span>
            <EditableField value={contact.whatsapp ?? ""} placeholder="—" onSave={saveText("whatsapp")} />
          </div>
          <div className={cellClass}>
            <span className={labelClass}>{t("inspector.field.city")}</span>
            <EditableField value={contact.city ?? ""} placeholder="—" onSave={saveText("city")} />
          </div>
          <div className={cellClass}>
            <span className={labelClass}>{t("inspector.field.country")}</span>
            <EditableField value={contact.country ?? ""} placeholder="—" onSave={saveText("country")} />
          </div>
          <div className={cellClass}>
            <span className={labelClass}>{t("contact.temperament")}</span>
            <EditableField value={contact.temperament ?? ""} placeholder="—" onSave={saveText("temperament")} />
          </div>
          {/* Last of an odd-numbered field list — spans both columns instead
              of leaving an empty cell dangling next to it. */}
          <div className={cn(cellClass, "sm:col-span-2")}>
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

      <div>
        <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.09em] text-muted-foreground">{t("contact.form.communities")}</div>
        {communities.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">{t("contact.form.communitiesEmpty")}</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {communities.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCommunity(c.id)}
                disabled={isSavingCommunities}
                className={`rounded px-2 py-0.5 text-xs transition-colors disabled:opacity-50 ${
                  communityIds.includes(c.id)
                    ? "bg-primary text-primary-foreground font-medium"
                    : "bg-muted border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[14px] border border-[#E2F0E9] bg-[#F4FAF7] px-[15px] py-3.5">
          <div className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.09em] text-[#3E8C6E]">{t("contact.valuePotential")}</div>
          <EditableField
            value={contact.valuePotential ?? ""}
            placeholder="—"
            multiline
            onSave={saveText("valuePotential")}
            className="text-[13.5px] leading-[1.5] text-[#24463A] hover:bg-[#E2F0E9]/60"
          />
        </div>
        <div className="rounded-[14px] border border-[#EFE6FA] bg-[#FBF6FE] px-[15px] py-3.5">
          <div className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.09em] text-[#7E5FC4]">{t("contact.needs")}</div>
          <EditableField
            value={contact.needs ?? ""}
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
            value={contact.fullSummary ?? ""}
            placeholder={t("contact.summaryEmpty")}
            multiline
            onSave={saveText("fullSummary")}
            className="text-[12.5px] leading-relaxed text-foreground"
          />
        </div>
      </div>
    </div>
  );
}
