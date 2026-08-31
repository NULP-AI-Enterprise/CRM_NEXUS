import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getCompaniesWithContacts } from "@/lib/data/companies";
import { CompaniesPageView } from "@/components/dashboard/companies-page-view";

export const metadata: Metadata = {
  title: "Компанії — Knowledge Graph CRM",
};

export default async function CompaniesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { companies } = await getCompaniesWithContacts(session.user.id);

  return <CompaniesPageView companies={companies} />;
}
