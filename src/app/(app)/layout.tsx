import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getEntityCounts } from "@/lib/data/counts";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SignOutButton } from "@/components/sign-out-button";
import { MainContent } from "@/components/layout/main-content";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const counts = await getEntityCounts(session.user.id);

  return (
    <div className="min-h-svh text-foreground selection:bg-accent/20 selection:text-foreground">
      <AppSidebar userEmail={session.user.email} counts={counts} signOutButton={<SignOutButton />} />
      <MainContent>{children}</MainContent>
    </div>
  );
}
