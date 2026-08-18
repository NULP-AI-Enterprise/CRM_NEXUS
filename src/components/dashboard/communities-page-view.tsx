"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-heading text-lg font-semibold text-foreground">
          {t("dashboard.tab.communities")}{" "}
          <span className="text-sm font-normal text-muted-foreground">({communities.length})</span>
        </h1>
        <Button
          size="sm"
          onClick={() => setIsNewCommunityOpen(true)}
          className="h-7 px-3 text-xs bg-secondary hover:bg-secondary/70 text-secondary-foreground gap-1.5 rounded-md"
        >
          <Plus className="size-3" />
          {t("dashboard.newCommunity")}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("filters.searchCommunities")}
            className="h-8 border-border bg-muted pl-8 text-xs"
          />
        </div>
        <div className="ml-auto text-[11px] text-muted-foreground">{t("filters.results", { count: filteredCommunities.length })}</div>
      </div>

      {filteredCommunities.length === 0 && query.trim() !== "" ? (
        <p className="rounded-xl border border-dashed border-border bg-muted p-8 text-center text-xs text-muted-foreground">
          {t("filters.empty")}
        </p>
      ) : (
        <CommunityAccordion communities={filteredCommunities} />
      )}

      <CommunityFormDialog open={isNewCommunityOpen} onOpenChange={setIsNewCommunityOpen} />
    </div>
  );
}
