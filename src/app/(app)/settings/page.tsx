import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { listApiKeys } from "@/lib/data/api-keys";
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

  return (
    <div className="flex flex-col gap-5 pb-12">
      <ApiKeysSection initialKeys={apiKeys} />
    </div>
  );
}
