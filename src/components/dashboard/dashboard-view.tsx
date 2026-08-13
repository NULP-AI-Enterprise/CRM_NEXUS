"use client";

import { useState } from "react";
import {
  Share2,
  Building2,
  Users,
  UsersRound,
  Star,
  Network,
  History,
  Plus,
} from "lucide-react";

import { QuickAddCard } from "@/components/quick-add/quick-add-card";
import { NetworkGraph } from "@/components/graph/network-graph";
import { TimelineView } from "@/components/timeline/timeline-view";
import { CompanyAccordion } from "@/components/dashboard/company-accordion";
import { CommunityAccordion } from "@/components/dashboard/community-accordion";
import { ContactCard } from "@/components/dashboard/contact-card";
import { ContactFormDialog } from "@/components/contacts/contact-form-dialog";
import { CompanyFormDialog } from "@/components/dashboard/company-form-dialog";
import { CommunityFormDialog } from "@/components/dashboard/community-form-dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/context";
import type { FullGraphData } from "@/lib/data/graph";
import type { TimelineEntity, TimelineEvent } from "@/lib/timeline-entity";
import type { CompanyModel, CommunityModel, ContactModel } from "@/generated/prisma/models";

type CompanyWithContacts = CompanyModel & { contacts: ContactModel[] };
type CommunityWithContacts = CommunityModel & { contacts: ContactModel[] };

interface DashboardViewProps {
  graphData: FullGraphData;
  companies: CompanyWithContacts[];
  unassignedContacts: ContactModel[];
  communities: CommunityWithContacts[];
  allContacts: ContactModel[];
  timelineEvents: TimelineEvent[];
  connectionEntities: TimelineEntity[];
}

export function DashboardView({
  graphData,
  companies,
  unassignedContacts,
  communities,
  allContacts,
  timelineEvents,
  connectionEntities,
}: DashboardViewProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"timeline" | "graph" | "companies" | "communities" | "contacts">("timeline");
  const [isNewContactOpen, setIsNewContactOpen] = useState(false);
  const [isNewCompanyOpen, setIsNewCompanyOpen] = useState(false);
  const [isNewCommunityOpen, setIsNewCommunityOpen] = useState(false);

  const companyOptions = companies.map((c) => ({ id: c.id, name: c.name }));
  const communityOptions = communities.map((c) => ({ id: c.id, name: c.name }));

  // Calculate average usefulness score
  const scoredContacts = allContacts.filter((c) => c.usefulnessScore != null);
  const avgScore =
    scoredContacts.length > 0
      ? (
          scoredContacts.reduce((acc, c) => acc + (c.usefulnessScore || 0), 0) /
          scoredContacts.length
        ).toFixed(1)
      : "—";

  return (
    <div className="flex flex-col gap-5 pb-12">
      {/* Top Quick-Add Card */}
      <QuickAddCard />

      {/* Telemetry Metrics Bar */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {/* Metric 1: Total Nodes */}
        <div className="rounded-xl border border-border bg-card p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-normal">
            <span>{t("dashboard.metric.nodes")}</span>
            <Network className="size-3.5 text-muted-foreground" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-semibold tracking-tight text-foreground tabular-nums">
              {graphData.nodes.length}
            </span>
            <span className="text-[11px] text-muted-foreground">{t("dashboard.metric.nodesUnit")}</span>
          </div>
        </div>

        {/* Metric 2: Total Links */}
        <div className="rounded-xl border border-border bg-card p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-normal">
            <span>{t("dashboard.metric.links")}</span>
            <Share2 className="size-3.5 text-muted-foreground" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-semibold tracking-tight text-foreground tabular-nums">
              {graphData.links.length}
            </span>
            <span className="text-[11px] text-muted-foreground">{t("dashboard.metric.linksUnit")}</span>
          </div>
        </div>

        {/* Metric 3: Companies */}
        <div className="rounded-xl border border-border bg-card p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-normal">
            <span>{t("dashboard.metric.companies")}</span>
            <Building2 className="size-3.5 text-muted-foreground" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-semibold tracking-tight text-foreground tabular-nums">
              {companies.length}
            </span>
            <span className="text-[11px] text-muted-foreground">{t("dashboard.metric.companiesUnit")}</span>
          </div>
        </div>

        {/* Metric 4: Avg Score */}
        <div className="rounded-xl border border-border bg-card p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-normal">
            <span>{t("dashboard.metric.avgScore")}</span>
            <Star className="size-3.5 text-muted-foreground" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-semibold tracking-tight text-foreground font-mono">
              {avgScore}
            </span>
            <span className="text-[11px] text-muted-foreground">/ 10</span>
          </div>
        </div>
      </div>

      {/* VIEW NAVIGATION SWITCHER (Segmented control) */}
      <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
        <div className="inline-flex items-center gap-1 bg-muted p-1 rounded-lg border border-border overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab("timeline")}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "timeline"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <History className="size-3.5" />
            <span>{t("dashboard.tab.timeline")}</span>
          </button>

          <button
            onClick={() => setActiveTab("graph")}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "graph"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Network className="size-3.5" />
            <span>{t("dashboard.tab.graph")}</span>
          </button>

          <button
            onClick={() => setActiveTab("companies")}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "companies"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Building2 className="size-3.5" />
            <span>{t("dashboard.tab.companies")}</span>
            <span className="text-[11px] text-muted-foreground font-mono">({companies.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("communities")}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "communities"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <UsersRound className="size-3.5" />
            <span>{t("dashboard.tab.communities")}</span>
            <span className="text-[11px] text-muted-foreground font-mono">({communities.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("contacts")}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "contacts"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="size-3.5" />
            <span>{t("dashboard.tab.contacts")}</span>
            <span className="text-[11px] text-muted-foreground font-mono">({allContacts.length})</span>
          </button>
        </div>

        {activeTab === "companies" && (
          <Button
            size="sm"
            onClick={() => setIsNewCompanyOpen(true)}
            className="h-7 px-3 text-xs bg-secondary hover:bg-secondary/70 text-secondary-foreground gap-1.5 rounded-md"
          >
            <Plus className="size-3" />
            {t("dashboard.newCompany")}
          </Button>
        )}
        {activeTab === "communities" && (
          <Button
            size="sm"
            onClick={() => setIsNewCommunityOpen(true)}
            className="h-7 px-3 text-xs bg-secondary hover:bg-secondary/70 text-secondary-foreground gap-1.5 rounded-md"
          >
            <Plus className="size-3" />
            {t("dashboard.newCommunity")}
          </Button>
        )}
        {activeTab === "contacts" && (
          <Button
            size="sm"
            onClick={() => setIsNewContactOpen(true)}
            className="h-7 px-3 text-xs bg-secondary hover:bg-secondary/70 text-secondary-foreground gap-1.5 rounded-md"
          >
            <Plus className="size-3" />
            {t("dashboard.newContact")}
          </Button>
        )}
      </div>

      {/* TAB CONTENT: Timeline */}
      {activeTab === "timeline" && (
        <TimelineView events={timelineEvents} emptyConnectionEntities={connectionEntities} />
      )}

      {/* TAB CONTENT: Interactive Graph */}
      {activeTab === "graph" && (
        <div className="space-y-4">
          <NetworkGraph initialData={graphData} />
        </div>
      )}

      {/* TAB CONTENT: Companies & Hubs */}
      {activeTab === "companies" && (
        <CompanyAccordion
          companies={companies}
          unassignedContacts={unassignedContacts}
        />
      )}

      {/* TAB CONTENT: Communities */}
      {activeTab === "communities" && <CommunityAccordion communities={communities} />}

      {/* TAB CONTENT: Contacts Grid */}
      {activeTab === "contacts" && (
        <div className="space-y-3">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {allContacts.map((contact) => (
              <ContactCard key={contact.id} contact={contact} />
            ))}
          </div>
        </div>
      )}

      <ContactFormDialog
        open={isNewContactOpen}
        onOpenChange={setIsNewContactOpen}
        companies={companyOptions}
        communities={communityOptions}
      />
      <CompanyFormDialog open={isNewCompanyOpen} onOpenChange={setIsNewCompanyOpen} />
      <CommunityFormDialog open={isNewCommunityOpen} onOpenChange={setIsNewCommunityOpen} />
    </div>
  );
}
