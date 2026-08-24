"use client";

import { useMemo, useState } from "react";

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
import { CompanyFormDialog } from "@/components/dashboard/company-form-dialog";
import { useTranslation } from "@/lib/i18n/context";
import type { CompanyModel, ContactModel } from "@/generated/prisma/models";

type CompanyWithContacts = CompanyModel & { contacts: ContactModel[] };

interface CompaniesPageViewProps {
  companies: CompanyWithContacts[];
  unassignedContacts: ContactModel[];
}

export function CompaniesPageView({ companies, unassignedContacts }: CompaniesPageViewProps) {
  const { t } = useTranslation();
  const [isNewCompanyOpen, setIsNewCompanyOpen] = useState(false);
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

  const filteredUnassigned = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (industry !== "ALL") return [];
    if (!q) return unassignedContacts;
    return unassignedContacts.filter((c) => c.fullName.toLowerCase().includes(q));
  }, [unassignedContacts, query, industry]);

  return (
    <div className="flex flex-col gap-4 pb-12">
      <ListHeader
        icon={EntityGlyph.companies()}
        tint={HEADER_TINT.companies}
        title={t("dashboard.tab.companies")}
        count={companies.length}
        action={<AddButton onClick={() => setIsNewCompanyOpen(true)}>{t("dashboard.newCompany")}</AddButton>}
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

      {filteredCompanies.length === 0 && filteredUnassigned.length === 0 && isFiltered ? (
        <ListEmpty>{t("filters.empty")}</ListEmpty>
      ) : (
        <CompanyAccordion companies={filteredCompanies} unassignedContacts={filteredUnassigned} />
      )}

      <CompanyFormDialog open={isNewCompanyOpen} onOpenChange={setIsNewCompanyOpen} />
    </div>
  );
}
