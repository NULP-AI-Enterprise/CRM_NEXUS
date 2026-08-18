import { notFound } from "next/navigation";

import { requireAdminPage } from "@/lib/admin/require-admin";
import { adminGetUserProfile } from "@/lib/data/admin";
import { listContacts } from "@/lib/data/contacts";
import { getCompaniesWithContacts } from "@/lib/data/companies";
import { getCommunitiesWithContacts } from "@/lib/data/communities";
import { getConnectionsWithNames } from "@/lib/data/connections";
import { AdminContactManager } from "@/components/admin/admin-contact-manager";
import { AdminCompanyManager } from "@/components/admin/admin-company-manager";
import { AdminCommunityManager } from "@/components/admin/admin-community-manager";
import { AdminConnectionsList } from "@/components/admin/admin-connections-list";

export default async function AdminUserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  await requireAdminPage();
  const { userId } = await params;

  const profile = await adminGetUserProfile(userId);
  if (!profile) notFound();

  const [contacts, { companies }, communities, connections] = await Promise.all([
    listContacts(userId),
    getCompaniesWithContacts(userId),
    getCommunitiesWithContacts(userId),
    getConnectionsWithNames(userId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-lg font-semibold text-foreground">{profile.email}</h1>
        <p className="text-xs text-muted-foreground">
          {profile.name ?? "No name"} · Joined {new Date(profile.createdAt).toISOString().slice(0, 10)} ·{" "}
          {profile.emailVerified ? "Verified" : "Not verified"}
        </p>
      </div>

      <AdminContactManager userId={userId} contacts={contacts} companies={companies.map((c) => ({ id: c.id, name: c.name }))} />
      <AdminCompanyManager userId={userId} companies={companies} />
      <AdminCommunityManager userId={userId} communities={communities} />
      <AdminConnectionsList userId={userId} connections={connections} />
    </div>
  );
}
