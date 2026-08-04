import Link from "next/link";
import { Network } from "lucide-react";

import { auth } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="flex min-h-svh flex-col text-foreground selection:bg-zinc-800 selection:text-zinc-100">
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-zinc-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <div className="flex size-6 items-center justify-center rounded-md bg-white text-zinc-950 shadow-sm transition-transform group-hover:scale-105">
              <Network className="size-3.5" />
            </div>
            <span className="text-xs font-semibold tracking-tight text-white">
              Nexus
            </span>
          </Link>

          <div className="flex items-center gap-2.5">
            {session?.user?.email && (
              <div className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-900 border border-white/[0.06] text-xs text-zinc-300">
                <span className="size-1.5 rounded-full bg-zinc-400" />
                <span className="text-zinc-400 font-mono text-[11px]">{session.user.email}</span>
              </div>
            )}
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 py-5">{children}</main>
    </div>
  );
}
