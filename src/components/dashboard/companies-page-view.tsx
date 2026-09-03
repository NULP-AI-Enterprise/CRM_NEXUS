"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  ListHeader,
  AddButton,
  FilterBar,
  SearchField,
  FilterSelect,
  FilterMeta,
  ListEmpty,
  EntityGlyph,
  HEADER_TINT,
} from "@/components/layout/list-chrome";
import { CompanyAccordion } from "@/components/dashboard/company-accordion";
import { useTranslation } from "@/lib/i18n/context";
import type { CompanyModel, ContactModel } from "@/generated/prisma/models";

type CompanyWithContacts = CompanyModel & { contacts: ContactModel[] };

interface CompaniesPageViewProps {
  companies: CompanyWithContacts[];
}

export function CompaniesPageView({ companies }: CompaniesPageViewProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [industry, setIndustry] = useState<string>("ALL");

  const industries = useMemo(
    () => Array.from(new Set(companies.map((c) => c.industry).filter((v): v is string => Boolean(v)))).sort(),
    [companies],
  );

  const isFiltered = query.trim() !== "" || industry !== "ALL";

  const filteredCompanies = useMemo(() => {
    const q = query.trim().toLowerCase();
    return companies.filter((c) => {
      if (industry !== "ALL" && c.industry !== industry) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [companies, query, industry]);

  const handleCreateNew = () => {
    startTransition(async () => {
      try {
        const tempName = `${t("dashboard.newCompany")} ${Math.floor(Math.random() * 10000)}`;
        const res = await fetch("/api/companies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: tempName }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error ?? t("common.unknownError"));
        }
        router.push(`/companies/${data.company.id}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("common.unknownError"));
      }
    });
  };

  return (
    <div className="flex flex-col gap-4 pb-12">
      <ListHeader
        icon={EntityGlyph.companies()}
        tint={HEADER_TINT.companies}
        title={t("dashboard.tab.companies")}
        count={companies.length}
        action={<AddButton onClick={handleCreateNew} disabled={isPending}>{t("dashboard.newCompany")}</AddButton>}
      />

      <FilterBar>
        <SearchField value={query} onChange={setQuery} placeholder={t("filters.searchCompanies")} />
        {industries.length > 0 && (
          <FilterSelect value={industry} onChange={(e) => setIndustry(e.target.value)}>
            <option value="ALL">{t("filters.allIndustries")}</option>
            {industries.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </FilterSelect>
        )}
        <FilterMeta
          resultLabel={t("filters.results", { count: filteredCompanies.length })}
          isFiltered={isFiltered}
          onReset={() => { setQuery(""); setIndustry("ALL"); }}
          resetLabel={t("filters.reset")}
        />
      </FilterBar>

      {filteredCompanies.length === 0 && isFiltered ? (
        <ListEmpty>{t("filters.empty")}</ListEmpty>
      ) : (
        <CompanyAccordion companies={filteredCompanies} />
      )}
    </div>
  );
}
