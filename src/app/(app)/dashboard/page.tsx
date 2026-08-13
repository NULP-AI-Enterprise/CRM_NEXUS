import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getCompaniesWithContacts } from "@/lib/data/companies";
import { getCommunitiesWithContacts } from "@/lib/data/communities";
import { getGraphData } from "@/lib/data/graph";
import { listContacts } from "@/lib/data/contacts";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export const metadata: Metadata = {
  title: "Мережа Зв'язків — Knowledge Graph CRM",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const [graphData, { companies, unassignedContacts }, communities, allContacts] = await Promise.all([
    getGraphData(session.user.id),
    getCompaniesWithContacts(session.user.id),
    getCommunitiesWithContacts(session.user.id),
    listContacts(session.user.id),
  ]);

  return (
    <DashboardView
      graphData={graphData}
      companies={companies}
      unassignedContacts={unassignedContacts}
      communities={communities}
      allContacts={allContacts}
    />
  );
}

