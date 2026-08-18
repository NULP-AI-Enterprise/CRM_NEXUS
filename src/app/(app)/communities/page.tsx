import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getCommunitiesWithContacts } from "@/lib/data/communities";
import { CommunitiesPageView } from "@/components/dashboard/communities-page-view";

export const metadata: Metadata = {
  title: "Спільноти — Knowledge Graph CRM",
};

export default async function CommunitiesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const communities = await getCommunitiesWithContacts(session.user.id);

  return <CommunitiesPageView communities={communities} />;
}
