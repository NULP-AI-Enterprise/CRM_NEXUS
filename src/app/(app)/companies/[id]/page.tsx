import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCompanyGraphData } from "@/lib/data/companies";
import { listContactsBasic } from "@/lib/data/contacts";
import { getOrgHistoryData } from "@/lib/data/timeline";
import { entityKey, entityLabel, nowIso } from "@/lib/timeline-entity";
import { getServerTranslation } from "@/lib/i18n/server";
import { CompanyHeader } from "@/components/dashboard/company-header";
import { CompanyProfileView } from "@/components/dashboard/company-profile-view";
import { HistoryGraphView } from "@/components/timeline/history-graph-view";

type CompanyPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: CompanyPageProps): Promise<Metadata> {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return {};

  const company = await prisma.company.findFirst({ where: { id, userId: session.user.id }, select: { name: true } });
  return { title: company ? `${company.name} — Knowledge Graph CRM` : "Company — CRM" };
}

export default async function CompanyPage({ params }: CompanyPageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const [company, data, orgHistory, allContacts, { t }] = await Promise.all([
    prisma.company.findFirst({ where: { id, userId: session.user.id } }),
    getCompanyGraphData(session.user.id, id),
    getOrgHistoryData(session.user.id, "company", id),
    listContactsBasic(session.user.id),
    getServerTranslation(),
  ]);
  if (!company || !data || !orgHistory) {
    notFound();
  }

  // Anyone not already assigned to this company — picking one just sets
  // their companyId, so someone already at a different company is still a
  // valid (if displacing) choice, matching the existing company-select on
  // the contact page itself.
  const availableContacts = allContacts.filter((c) => c.companyId !== company.id);

  // Guarantees the company itself and every member are choosable in
  // "+ New entry" even before they have any logged interaction — the graph's
  // own event-derived option list would otherwise omit anyone with no
  // history yet.
  const pinnedEntities = [
    { key: entityKey({ kind: "company", company }), label: entityLabel({ kind: "company", company }) },
    ...data.members.map((m) => ({
      key: entityKey({ kind: "contact", contact: { id: m.id, fullName: m.fullName, category: m.category } }),
      label: m.fullName,
    })),
  ];

  return (
    <div className="flex flex-col gap-5 pb-12">
      <div className="flex items-center gap-1.5 text-[11.5px] text-[#8c8c86]">
        <Link href="/companies" className="font-medium hover:text-foreground transition-colors">
          {t("dashboard.tab.companies")}
        </Link>
        <span>/</span>
        <span className="font-medium text-foreground">{company.name}</span>
      </div>

      <div className="rounded-[18px] border border-border bg-card overflow-hidden">
        <CompanyHeader company={company} />
        <CompanyProfileView data={data} availableContacts={availableContacts} />
      </div>

      <div className="rounded-[18px] border border-border bg-card p-5">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground">{t("cluster.title")}</div>
        <div className="h-[560px] overflow-hidden rounded-[14px] border border-border">
          <HistoryGraphView events={orgHistory.events} connections={orgHistory.connections} nowIso={nowIso()} pinnedEntities={pinnedEntities} />
        </div>
      </div>
    </div>
  );
}
