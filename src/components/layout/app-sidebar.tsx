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
      title: "Overview",
      items: [{ href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" }],
    },
    {
      title: "Entities",
      items: [
        { href: "/projects", icon: Network, label: "Projects", count: 16, color: ICON_COLOR.connections },
        { href: "/companies", icon: Building2, label: "Companies", count: counts.companies || 22, color: ICON_COLOR.companies },
        { href: "/contacts", icon: Users, label: "People", count: counts.contacts || 42, color: ICON_COLOR.contacts },
        { href: "/communities", icon: UsersRound, label: "Communities", count: counts.communities || 14, color: ICON_COLOR.communities },
      ],
    },
    {
      title: "Network",
      items: [
        { href: "/network", icon: Share2, label: "Relationship graph", color: ICON_COLOR.network },
        { href: "/timeline", icon: History, label: "History graph", color: ICON_COLOR.timeline },
      ],
    },
    {
      title: "Activity",
      items: [{ href: "/activity", icon: Bell, label: "Interaction history" }],
    },
  ];

  const navContent = (
    <>
      <Link href="/dashboard" className="flex items-center gap-2 px-1 group" onClick={() => setIsMobileOpen(false)}>
        <div className="flex size-[26px] items-center justify-center rounded-[9px] bg-[#1b1d21] text-sidebar-primary-foreground shadow-sm shrink-0 relative">
          <div className="absolute left-[6px] top-[6px] size-[6px] rounded-full bg-[#ef8163]" />
          <div className="absolute right-[6px] top-[7px] size-[5px] rounded-full bg-[#5b8def]" />
          <div className="absolute left-[9px] bottom-[5px] size-[5px] rounded-full bg-[#9b7be0]" />
        </div>
        <div>
          <div className="text-[14px] font-semibold tracking-[-0.2px] text-sidebar-foreground">Weave</div>
          <div className="font-mono text-[9.5px] uppercase tracking-[0.06em] text-[#9a9a94]">network crm</div>
        </div>
      </Link>

      <nav className="flex-1 space-y-5 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.title}>
            <div className="px-2 pb-[6px] font-mono text-[9px] uppercase tracking-[0.1em] text-[#a6a6a0]">
              {section.title}
            </div>
            <div className="space-y-[3px]">
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={`${section.title}-${item.href}-${item.label}`}
                    href={item.href}
                    onClick={() => setIsMobileOpen(false)}
                    className={`flex items-center gap-[9px] rounded-[9px] px-[10px] py-[8px] text-[13px] font-medium transition-colors ${
                      isActive
                        ? "bg-[#eaf1fe] text-[#3a3c42]"
                        : "text-[#3a3c42] hover:bg-[#F4F4F1]"
                    }`}
                  >
                    {/* SVG styling to exactly match template logic for dots/icons if we want, but for now we keep Lucide icons tinted */}
                    <Icon className="size-[15px] shrink-0" style={{ color: item.color || "#6e7480" }} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.count != null && (
                      <span className="text-[11px] font-semibold text-muted-foreground">{item.count}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="pt-3 border-t border-[#ecebe7]">
        <Link
          href="/forms"
          onClick={() => setIsMobileOpen(false)}
          className="flex items-center gap-[7px] rounded-[9px] border border-[#ecebe7] bg-[#ffffff] px-[10px] py-[8px] text-[13px] font-medium text-[#1b1d21] shadow-[0_1px_2px_rgba(27,29,33,0.04)] hover:bg-[#F4F4F1] transition-colors"
        >
          <div className="flex size-[14px] items-center justify-center rounded-[4px] border border-[#ecebe7] bg-[#f6f6f4]">
            <span className="text-[10px] text-[#9a9a94]">+</span>
          </div>
          Add / edit
        </Link>
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
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:flex-col lg:border-r lg:border-sidebar-border lg:bg-sidebar" style={{ width: "236px", padding: "20px 14px", gap: "22px" }}>
        {navContent}
      </aside>
    </>
  );
}
