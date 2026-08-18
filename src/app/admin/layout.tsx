import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { requireAdminPage } from "@/lib/admin/require-admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/admin" className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-destructive" />
            <span className="font-heading text-sm font-semibold text-foreground">Admin</span>
          </Link>
          <Link href="/dashboard" className="text-xs text-muted-foreground hover:text-foreground">
            Exit admin
          </Link>
        </div>
      </div>
      <main className="mx-auto max-w-5xl px-4 py-5 sm:px-6">{children}</main>
    </div>
  );
}
