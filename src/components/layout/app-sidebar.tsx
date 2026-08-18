"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Network,
  LayoutDashboard,
  Users,
  Building2,
  UsersRound,
  Share2,
  History,
  Bell,
  Settings,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";

import { LanguageSwitcher } from "@/components/language-switcher";
import { useTranslation } from "@/lib/i18n/context";
import type { EntityCounts } from "@/lib/data/counts";

interface NavItem {
  href: string;
  icon: LucideIcon;
  label: string;
  count?: number;
  color?: string;
}

// Each entity/network type keeps one signature color for its icon everywhere
// it appears in the nav — the same accents used for category dots elsewhere,
// applied here to entity *type* instead of contact category.
const ICON_COLOR = {
  contacts: "#EF8163",
  companies: "#43A883",
  communities: "#9B7BE0",
  connections: "#5B8DEF",
  network: "#5B8DEF",
  timeline: "#E9A15F",
};

interface AppSidebarProps {
  userEmail?: string | null;
  counts: EntityCounts;
  signOutButton: React.ReactNode;
}

export function AppSidebar({ userEmail, counts, signOutButton }: AppSidebarProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const sections: Array<{ title: string; items: NavItem[] }> = [
    {
      title: t("nav.overview"),
      items: [{ href: "/dashboard", icon: LayoutDashboard, label: t("nav.dashboard") }],
    },
    {
      title: t("nav.entities"),
      items: [
        { href: "/contacts", icon: Users, label: t("dashboard.tab.contacts"), count: counts.contacts, color: ICON_COLOR.contacts },
        { href: "/companies", icon: Building2, label: t("dashboard.tab.companies"), count: counts.companies, color: ICON_COLOR.companies },
        { href: "/communities", icon: UsersRound, label: t("dashboard.tab.communities"), count: counts.communities, color: ICON_COLOR.communities },
        { href: "/network", icon: Share2, label: t("nav.connections"), count: counts.connections, color: ICON_COLOR.connections },
      ],
    },
    {
      title: t("nav.network"),
      items: [
        { href: "/network", icon: Network, label: t("dashboard.tab.graph"), color: ICON_COLOR.network },
        { href: "/timeline", icon: History, label: t("dashboard.tab.timeline"), color: ICON_COLOR.timeline },
      ],
    },
    {
      title: t("nav.activity"),
      items: [{ href: "/activity", icon: Bell, label: t("nav.followUps") }],
    },
  ];

  const navContent = (
    <>
      <Link href="/dashboard" className="flex items-center gap-2 px-1 group" onClick={() => setIsMobileOpen(false)}>
        <div className="flex size-6 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground shadow-sm transition-transform group-hover:scale-105 shrink-0">
          <Network className="size-3.5" />
        </div>
        <span className="font-heading text-sm font-semibold tracking-tight text-sidebar-foreground">
          {t("nav.brand")}
        </span>
      </Link>

      <nav className="mt-6 flex-1 space-y-5 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.title}>
            <div className="px-2 pb-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {section.title}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={`${section.title}-${item.href}-${item.label}`}
                    href={item.href}
                    onClick={() => setIsMobileOpen(false)}
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/60"
                    }`}
                  >
                    <Icon className="size-3.5 shrink-0" style={item.color ? { color: item.color } : undefined} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.count != null && (
                      <span className="text-[10px] font-mono text-muted-foreground">{item.count}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-auto space-y-2 border-t border-sidebar-border pt-3">
        {userEmail && (
          <div className="flex items-center gap-1.5 rounded-md border border-sidebar-border bg-card px-2 py-1 text-[11px] text-muted-foreground">
            <span className="size-1.5 shrink-0 rounded-full bg-accent" />
            <span className="truncate font-mono">{userEmail}</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-1">
          <Link
            href="/settings"
            title={t("nav.settings")}
            onClick={() => setIsMobileOpen(false)}
            className="flex size-7 items-center justify-center rounded-md border border-sidebar-border bg-card text-muted-foreground hover:text-sidebar-foreground transition-colors"
          >
            <Settings className="size-3.5" />
          </Link>
          <LanguageSwitcher />
          {signOutButton}
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar. Height is pinned rather than derived from its content
          because full-bleed screens subtract it to compute their own height —
          a bar that grows by a pixel would push their bottom edge off-screen. */}
      <div className="flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-xl lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
            <Network className="size-3.5" />
          </div>
          <span className="font-heading text-sm font-semibold tracking-tight text-foreground">{t("nav.brand")}</span>
        </Link>
        <button
          onClick={() => setIsMobileOpen(true)}
          title={t("nav.openMenu")}
          className="flex size-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground"
        >
          <Menu className="size-4" />
        </button>
      </div>

      {/* Mobile drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setIsMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-64 max-w-[85vw] flex-col bg-sidebar px-3 py-4 shadow-2xl">
            <button
              onClick={() => setIsMobileOpen(false)}
              title={t("nav.closeMenu")}
              className="absolute right-3 top-4 flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
            {navContent}
          </div>
        </div>
      )}

      {/* Desktop fixed sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-60 lg:flex-col lg:border-r lg:border-sidebar-border lg:bg-sidebar lg:px-3 lg:py-4">
        {navContent}
      </aside>
    </>
  );
}
