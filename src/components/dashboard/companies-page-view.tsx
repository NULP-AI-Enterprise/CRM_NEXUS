"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-heading text-lg font-semibold text-foreground">
          {t("dashboard.tab.companies")} <span className="text-sm font-normal text-muted-foreground">({companies.length})</span>
        </h1>
        <Button
          size="sm"
          onClick={() => setIsNewCompanyOpen(true)}
          className="h-7 px-3 text-xs bg-secondary hover:bg-secondary/70 text-secondary-foreground gap-1.5 rounded-md"
        >
          <Plus className="size-3" />
          {t("dashboard.newCompany")}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("filters.searchCompanies")}
            className="h-8 border-border bg-muted pl-8 text-xs"
          />
        </div>
        {industries.length > 0 && (
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="h-8 rounded-md border border-border bg-muted px-2 text-xs text-foreground"
          >
            <option value="ALL">{t("filters.allIndustries")}</option>
            {industries.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        )}
        <div className="ml-auto flex items-center gap-2 border-l border-border pl-2.5 text-[11px] text-muted-foreground">
          <span>{t("filters.results", { count: filteredCompanies.length })}</span>
          {isFiltered && (
            <button onClick={() => { setQuery(""); setIndustry("ALL"); }} className="font-semibold text-accent hover:underline">
              {t("filters.reset")}
            </button>
          )}
        </div>
      </div>

      {filteredCompanies.length === 0 && filteredUnassigned.length === 0 && isFiltered ? (
        <p className="rounded-xl border border-dashed border-border bg-muted p-8 text-center text-xs text-muted-foreground">
          {t("filters.empty")}
        </p>
      ) : (
        <CompanyAccordion companies={filteredCompanies} unassignedContacts={filteredUnassigned} />
      )}

      <CompanyFormDialog open={isNewCompanyOpen} onOpenChange={setIsNewCompanyOpen} />
    </div>
  );
}
