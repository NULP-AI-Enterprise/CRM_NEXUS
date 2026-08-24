import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { listApiKeys } from "@/lib/data/api-keys";
import { ProfileSection } from "@/components/settings/profile-section";
import { ApiKeysSection } from "@/components/settings/api-keys-section";

export const metadata: Metadata = {
  title: "Налаштування — Knowledge Graph CRM",
};

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const apiKeys = await listApiKeys(session.user.id);
  const mcpEndpoint = `${process.env.APP_URL || "http://localhost:3000"}/api/mcp`;

  return (
    <div className="flex flex-col gap-5 pb-12">
      <ProfileSection initialName={session.user.name ?? null} email={session.user.email ?? ""} />
      <ApiKeysSection initialKeys={apiKeys} mcpEndpoint={mcpEndpoint} />
    </div>
  );
}
