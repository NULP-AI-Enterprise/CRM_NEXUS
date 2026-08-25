import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { listApiKeys } from "@/lib/data/api-keys";
import { listOAuthClients } from "@/lib/data/oauth-clients";
import { ALLOWED_REDIRECT_URIS } from "@/lib/mcp/oauth";
import { ProfileSection } from "@/components/settings/profile-section";
import { ApiKeysSection } from "@/components/settings/api-keys-section";
import { OAuthClientSection } from "@/components/settings/oauth-client-section";

export const metadata: Metadata = {
  title: "Налаштування — Knowledge Graph CRM",
};

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const [apiKeys, oauthClients] = await Promise.all([
    listApiKeys(session.user.id),
    listOAuthClients(session.user.id),
  ]);
  const mcpEndpoint = `${process.env.APP_URL || "http://localhost:3000"}/api/mcp`;

  return (
    <div className="flex flex-col gap-5 pb-12">
      <ProfileSection initialName={session.user.name ?? null} email={session.user.email ?? ""} />
      <ApiKeysSection initialKeys={apiKeys} mcpEndpoint={mcpEndpoint} />
      <OAuthClientSection initialClients={oauthClients} allowedRedirectUris={ALLOWED_REDIRECT_URIS} />
    </div>
  );
}
