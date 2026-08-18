"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-heading text-lg font-semibold text-foreground">
          {t("dashboard.tab.contacts")} <span className="text-sm font-normal text-muted-foreground">({contacts.length})</span>
        </h1>
        <Button
          size="sm"
          onClick={() => setIsNewContactOpen(true)}
          className="h-7 px-3 text-xs bg-secondary hover:bg-secondary/70 text-secondary-foreground gap-1.5 rounded-md"
        >
          <Plus className="size-3" />
          {t("dashboard.newContact")}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("filters.searchContacts")}
            className="h-8 border-border bg-muted pl-8 text-xs"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as ContactCategory | "ALL")}
          className="h-8 rounded-md border border-border bg-muted px-2 text-xs text-foreground"
        >
          <option value="ALL">{t("filters.allCategories")}</option>
          {(["VIP", "INVESTOR", "LEAD", "COLLEAGUE", "FRIEND", "HR", "OTHER"] as ContactCategory[]).map((cat) => (
            <option key={cat} value={cat}>
              {t(`category.${cat}`)}
            </option>
          ))}
        </select>
        {temperaments.length > 0 && (
          <select
            value={temperament}
            onChange={(e) => setTemperament(e.target.value)}
            className="h-8 rounded-md border border-border bg-muted px-2 text-xs text-foreground"
          >
            <option value="ALL">{t("filters.allTemperaments")}</option>
            {temperaments.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        )}
        {locations.length > 0 && (
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="h-8 rounded-md border border-border bg-muted px-2 text-xs text-foreground"
          >
            <option value="ALL">{t("filters.allLocations")}</option>
            {locations.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        )}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="h-8 rounded-md border border-border bg-muted px-2 text-xs text-foreground"
        >
          <option value="score">{t("filters.sort.score")}</option>
          <option value="name">{t("filters.sort.name")}</option>
          <option value="recent">{t("filters.sort.recent")}</option>
        </select>
        <div className="ml-auto flex items-center gap-2 border-l border-border pl-2.5 text-[11px] text-muted-foreground">
          <span>{t("filters.results", { count: filteredContacts.length })}</span>
          {isFiltered && (
            <button onClick={resetFilters} className="font-semibold text-accent hover:underline">
              {t("filters.reset")}
            </button>
          )}
        </div>
      </div>

      {filteredContacts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted p-8 text-center text-xs text-muted-foreground">
          {t("filters.empty")}
        </p>
      ) : (
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
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
