"use client";

import { useMemo, useState } from "react";

import {
  ListHeader,
  AddButton,
  FilterBar,
  SearchField,
  FilterMeta,
  ListEmpty,
  EntityGlyph,
  HEADER_TINT,
} from "@/components/layout/list-chrome";
import { CommunityAccordion } from "@/components/dashboard/community-accordion";
import { CommunityFormDialog } from "@/components/dashboard/community-form-dialog";
import { useTranslation } from "@/lib/i18n/context";
import type { CommunityModel, ContactModel } from "@/generated/prisma/models";

type CommunityWithContacts = CommunityModel & { contacts: ContactModel[] };

export function CommunitiesPageView({ communities }: { communities: CommunityWithContacts[] }) {
  const { t } = useTranslation();
  const [isNewCommunityOpen, setIsNewCommunityOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filteredCommunities = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return communities;
    return communities.filter((c) => c.name.toLowerCase().includes(q));
  }, [communities, query]);

  return (
    <div className="flex flex-col gap-4 pb-12">
      <ListHeader
        icon={EntityGlyph.communities()}
        tint={HEADER_TINT.communities}
        title={t("dashboard.tab.communities")}
        count={communities.length}
        action={<AddButton onClick={() => setIsNewCommunityOpen(true)}>{t("dashboard.newCommunity")}</AddButton>}
      />

      <FilterBar>
        <SearchField value={query} onChange={setQuery} placeholder={t("filters.searchCommunities")} />
        <FilterMeta
          resultLabel={t("filters.results", { count: filteredCommunities.length })}
          isFiltered={query.trim() !== ""}
          onReset={() => setQuery("")}
          resetLabel={t("filters.reset")}
        />
      </FilterBar>

      {filteredCommunities.length === 0 && query.trim() !== "" ? (
        <ListEmpty>{t("filters.empty")}</ListEmpty>
      ) : (
        <CommunityAccordion communities={filteredCommunities} />
      )}

      <CommunityFormDialog open={isNewCommunityOpen} onOpenChange={setIsNewCommunityOpen} />
    </div>
  );
}
