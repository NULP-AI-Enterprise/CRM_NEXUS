"use client";

import { useState } from "react";
import {
  Share2,
  Building2,
  Users,
  Star,
  Network,
  Plus,
} from "lucide-react";

import { QuickAddCard } from "@/components/quick-add/quick-add-card";
import { NetworkGraph } from "@/components/graph/network-graph";
import { CompanyAccordion } from "@/components/dashboard/company-accordion";
import { ContactCard } from "@/components/dashboard/contact-card";
import { ContactFormDialog } from "@/components/contacts/contact-form-dialog";
import { CompanyFormDialog } from "@/components/dashboard/company-form-dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/context";
import type { FullGraphData } from "@/lib/data/graph";
import type { CompanyModel, ContactModel } from "@/generated/prisma/models";

type CompanyWithContacts = CompanyModel & { contacts: ContactModel[] };

interface DashboardViewProps {
  graphData: FullGraphData;
  companies: CompanyWithContacts[];
  unassignedContacts: ContactModel[];
  allContacts: ContactModel[];
}

export function DashboardView({
  graphData,
  companies,
  unassignedContacts,
  allContacts,
}: DashboardViewProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"graph" | "companies" | "contacts">("graph");
  const [isNewContactOpen, setIsNewContactOpen] = useState(false);
  const [isNewCompanyOpen, setIsNewCompanyOpen] = useState(false);

  const companyOptions = companies.map((c) => ({ id: c.id, name: c.name }));

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
        <div className="rounded-xl border border-white/[0.07] bg-zinc-900/40 p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-normal">
            <span>{t("dashboard.metric.nodes")}</span>
            <Network className="size-3.5 text-zinc-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-semibold tracking-tight text-white tabular-nums">
              {graphData.nodes.length}
            </span>
            <span className="text-[11px] text-zinc-500">{t("dashboard.metric.nodesUnit")}</span>
          </div>
        </div>

        {/* Metric 2: Total Links */}
        <div className="rounded-xl border border-white/[0.07] bg-zinc-900/40 p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-normal">
            <span>{t("dashboard.metric.links")}</span>
            <Share2 className="size-3.5 text-zinc-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-semibold tracking-tight text-white tabular-nums">
              {graphData.links.length}
            </span>
            <span className="text-[11px] text-zinc-500">{t("dashboard.metric.linksUnit")}</span>
          </div>
        </div>

        {/* Metric 3: Companies */}
        <div className="rounded-xl border border-white/[0.07] bg-zinc-900/40 p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-normal">
            <span>{t("dashboard.metric.companies")}</span>
            <Building2 className="size-3.5 text-zinc-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-semibold tracking-tight text-white tabular-nums">
              {companies.length}
            </span>
            <span className="text-[11px] text-zinc-500">{t("dashboard.metric.companiesUnit")}</span>
          </div>
        </div>

        {/* Metric 4: Avg Score */}
        <div className="rounded-xl border border-white/[0.07] bg-zinc-900/40 p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-normal">
            <span>{t("dashboard.metric.avgScore")}</span>
            <Star className="size-3.5 text-zinc-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-semibold tracking-tight text-white font-mono">
              {avgScore}
            </span>
            <span className="text-[11px] text-zinc-500">/ 10</span>
          </div>
        </div>
      </div>

      {/* VIEW NAVIGATION SWITCHER (Segmented control) */}
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.07] pb-3">
        <div className="inline-flex items-center gap-1 bg-zinc-900/60 p-1 rounded-lg border border-white/[0.06]">
          <button
            onClick={() => setActiveTab("graph")}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "graph"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Network className="size-3.5" />
            <span>{t("dashboard.tab.graph")}</span>
          </button>

          <button
            onClick={() => setActiveTab("companies")}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "companies"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Building2 className="size-3.5" />
            <span>{t("dashboard.tab.companies")}</span>
            <span className="text-[11px] text-zinc-500 font-mono">({companies.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("contacts")}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "contacts"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Users className="size-3.5" />
            <span>{t("dashboard.tab.contacts")}</span>
            <span className="text-[11px] text-zinc-500 font-mono">({allContacts.length})</span>
          </button>
        </div>

        {activeTab === "companies" && (
          <Button
            size="sm"
            onClick={() => setIsNewCompanyOpen(true)}
            className="h-7 px-3 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-100 gap-1.5 rounded-md"
          >
            <Plus className="size-3" />
            {t("dashboard.newCompany")}
          </Button>
        )}
        {activeTab === "contacts" && (
          <Button
            size="sm"
            onClick={() => setIsNewContactOpen(true)}
            className="h-7 px-3 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-100 gap-1.5 rounded-md"
          >
            <Plus className="size-3" />
            {t("dashboard.newContact")}
          </Button>
        )}
      </div>

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
      />
      <CompanyFormDialog open={isNewCompanyOpen} onOpenChange={setIsNewCompanyOpen} />
    </div>
  );
}
