import { LogOut } from "lucide-react";

import { signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { getServerTranslation } from "@/lib/i18n/server";

export async function SignOutButton() {
  const { t } = await getServerTranslation();

  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <Button variant="ghost" size="icon" type="submit" title={t("nav.signOut")}>
        <LogOut />
      </Button>
    </form>
  );
}
