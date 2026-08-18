import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { listContacts } from "@/lib/data/contacts";
import { listCompanies } from "@/lib/data/companies";
import { listCommunities } from "@/lib/data/communities";
import { ContactsPageView } from "@/components/contacts/contacts-page-view";

export const metadata: Metadata = {
  title: "Контакти — Knowledge Graph CRM",
};

export default async function ContactsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const [contacts, companies, communities] = await Promise.all([
    listContacts(session.user.id),
    listCompanies(session.user.id),
    listCommunities(session.user.id),
  ]);

  return <ContactsPageView contacts={contacts} companies={companies} communities={communities} />;
}
