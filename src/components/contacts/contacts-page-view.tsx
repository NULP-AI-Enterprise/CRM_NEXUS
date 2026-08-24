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
import { ContactCard } from "@/components/dashboard/contact-card";
import { ContactFormDialog } from "@/components/contacts/contact-form-dialog";
import { useTranslation } from "@/lib/i18n/context";
import type { ContactCategory } from "@/generated/prisma/enums";
import type { ContactModel } from "@/generated/prisma/models";

type ContactWithLastInteraction = ContactModel & { interactions: Array<{ createdAt: Date }> };

interface ContactsPageViewProps {
  contacts: ContactWithLastInteraction[];
  companies: Array<{ id: string; name: string }>;
  communities: Array<{ id: string; name: string }>;
}

type SortOption = "score" | "name" | "recent";

export function ContactsPageView({ contacts, companies, communities }: ContactsPageViewProps) {
  const { t } = useTranslation();
  const [isNewContactOpen, setIsNewContactOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ContactCategory | "ALL">("ALL");
  const [temperament, setTemperament] = useState<string>("ALL");
  const [location, setLocation] = useState<string>("ALL");
  const [sort, setSort] = useState<SortOption>("score");

  const temperaments = useMemo(
    () => Array.from(new Set(contacts.map((c) => c.temperament).filter((v): v is string => Boolean(v)))).sort(),
    [contacts],
  );
  const locations = useMemo(
    () => Array.from(new Set(contacts.map((c) => c.city).filter((v): v is string => Boolean(v)))).sort(),
    [contacts],
  );

  const isFiltered = query.trim() !== "" || category !== "ALL" || temperament !== "ALL" || location !== "ALL";

  const filteredContacts = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = contacts.filter((c) => {
      if (category !== "ALL" && c.category !== category) return false;
      if (temperament !== "ALL" && c.temperament !== temperament) return false;
      if (location !== "ALL" && c.city !== location) return false;
      if (q) {
        const haystack = `${c.fullName} ${c.role ?? ""} ${c.companyName ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    return filtered.slice().sort((a, b) => {
      if (sort === "name") return a.fullName.localeCompare(b.fullName);
      if (sort === "recent") {
        const aTime = a.interactions[0]?.createdAt.getTime() ?? 0;
        const bTime = b.interactions[0]?.createdAt.getTime() ?? 0;
        return bTime - aTime;
      }
      return (b.usefulnessScore ?? 0) - (a.usefulnessScore ?? 0);
    });
  }, [contacts, query, category, temperament, location, sort]);

  const resetFilters = () => {
    setQuery("");
    setCategory("ALL");
    setTemperament("ALL");
    setLocation("ALL");
  };

  return (
    <div className="flex flex-col gap-4 pb-12">
      <ListHeader
        icon={EntityGlyph.people()}
        tint={HEADER_TINT.people}
        title={t("dashboard.tab.contacts")}
        count={contacts.length}
        action={<AddButton onClick={() => setIsNewContactOpen(true)}>{t("dashboard.newContact")}</AddButton>}
      />

      <FilterBar>
        <SearchField value={query} onChange={setQuery} placeholder={t("filters.searchContacts")} />
        <FilterSelect value={category} onChange={(e) => setCategory(e.target.value as ContactCategory | "ALL")}>
          <option value="ALL">{t("filters.allCategories")}</option>
          {(["VIP", "INVESTOR", "LEAD", "COLLEAGUE", "FRIEND", "HR", "OTHER"] as ContactCategory[]).map((cat) => (
            <option key={cat} value={cat}>
              {t(`category.${cat}`)}
            </option>
          ))}
        </FilterSelect>
        {temperaments.length > 0 && (
          <FilterSelect value={temperament} onChange={(e) => setTemperament(e.target.value)}>
            <option value="ALL">{t("filters.allTemperaments")}</option>
            {temperaments.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </FilterSelect>
        )}
        {locations.length > 0 && (
          <FilterSelect value={location} onChange={(e) => setLocation(e.target.value)}>
            <option value="ALL">{t("filters.allLocations")}</option>
            {locations.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </FilterSelect>
        )}
        <FilterSelect value={sort} onChange={(e) => setSort(e.target.value as SortOption)}>
          <option value="score">{t("filters.sort.score")}</option>
          <option value="name">{t("filters.sort.name")}</option>
          <option value="recent">{t("filters.sort.recent")}</option>
        </FilterSelect>
        <FilterMeta
          resultLabel={t("filters.results", { count: filteredContacts.length })}
          isFiltered={isFiltered}
          onReset={resetFilters}
          resetLabel={t("filters.reset")}
        />
      </FilterBar>

      {filteredContacts.length === 0 ? (
        <ListEmpty>{t("filters.empty")}</ListEmpty>
      ) : (
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {filteredContacts.map((contact) => (
            <ContactCard key={contact.id} contact={contact} />
          ))}
        </div>
      )}

      <ContactFormDialog
        open={isNewContactOpen}
        onOpenChange={setIsNewContactOpen}
        companies={companies}
        communities={communities}
      />
    </div>
  );
}
