"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
import { useTranslation } from "@/lib/i18n/context";
import type { CommunityModel, ContactModel } from "@/generated/prisma/models";

type CommunityWithContacts = CommunityModel & { contacts: ContactModel[] };

export function CommunitiesPageView({ communities }: { communities: CommunityWithContacts[] }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");

  const filteredCommunities = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return communities;
    return communities.filter((c) => c.name.toLowerCase().includes(q));
  }, [communities, query]);

  const handleCreateNew = () => {
    startTransition(async () => {
      try {
        const tempName = `${t("dashboard.newCommunity")} ${Math.floor(Math.random() * 10000)}`;
        const res = await fetch("/api/communities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: tempName }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error ?? t("common.unknownError"));
        }
        router.push(`/communities/${data.community.id}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("common.unknownError"));
      }
    });
  };

  return (
    <div className="flex flex-col gap-4 pb-12">
      <ListHeader
        icon={EntityGlyph.communities()}
        tint={HEADER_TINT.communities}
        title={t("dashboard.tab.communities")}
        count={communities.length}
        action={<AddButton onClick={handleCreateNew} disabled={isPending}>{t("dashboard.newCommunity")}</AddButton>}
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
    </div>
  );
}
