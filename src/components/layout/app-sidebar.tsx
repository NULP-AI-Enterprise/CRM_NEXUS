"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

import { LanguageSwitcher } from "@/components/language-switcher";
import { useTranslation } from "@/lib/i18n/context";
import type { EntityCounts } from "@/lib/data/counts";

// ── Category accents (icon stroke + tinted active background) ─────────────
// The reference design paints each entity type with one signature accent and a
// matching low-saturation tint behind the active row. Neutral rows (Dashboard,
// graph, activity) fall back to the warm-grey tint with a hairline border.
const TINT = {
  neutral: { bg: "#f1f1ed", border: "#e6e5e0" },
  people: { bg: "#fdede7", border: "transparent" },
  companies: { bg: "#e8f6f0", border: "transparent" },
  communities: { bg: "#f1ebfc", border: "transparent" },
  connections: { bg: "#eaf1fe", border: "transparent" },
  timeline: { bg: "#edf2f8", border: "#dde6f1" },
} as const;

// Reference-template SVG glyphs, reproduced path-for-path so the nav matches
// pixel-for-pixel. Each takes the accent colour so one glyph serves light rows.
type IconProps = { color?: string };

const NavIcons = {
  dashboard: () => (
    <span
      className="relative shrink-0"
      style={{ width: 14, height: 14, borderRadius: 4, border: "1.5px solid #6e7480" }}
    />
  ),
  people: ({ color = "#EF8163" }: IconProps) => (
    <svg className="relative shrink-0" width="15" height="15" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5.6" r="2.9" stroke={color} strokeWidth="1.5" />
      <path d="M2.6 14.2c0-3.2 2.4-5 5.4-5s5.4 1.8 5.4 5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  companies: ({ color = "#43A883" }: IconProps) => (
    <svg className="relative shrink-0" width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M2.8 14.2V3.2h6.4v11" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9.2 14.2V6.6h4v7.6" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M4.9 5.9h2.2M4.9 8.5h2.2M4.9 11.1h2.2" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  communities: ({ color = "#9B7BE0" }: IconProps) => (
    <svg className="relative shrink-0" width="15" height="15" viewBox="0 0 16 16" fill="none">
      <circle cx="5.2" cy="6.1" r="2.1" stroke={color} strokeWidth="1.5" />
      <circle cx="10.8" cy="6.1" r="2.1" stroke={color} strokeWidth="1.5" />
      <circle cx="8" cy="11.2" r="2.3" stroke={color} strokeWidth="1.5" />
    </svg>
  ),
  connections: ({ color = "#5B8DEF" }: IconProps) => (
    <svg className="relative shrink-0" width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M4.2 14.4V2.2" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4.2 3.1h8.2l-1.9 2.7 1.9 2.7H4.2" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  graph: () => (
    <svg className="relative shrink-0" width="15" height="15" viewBox="0 0 15 15">
      <line x1="4" y1="4" x2="11" y2="9" stroke="#6E7480" strokeWidth="1.2" />
      <line x1="4" y1="4" x2="4" y2="11" stroke="#6E7480" strokeWidth="1.2" />
      <circle cx="4" cy="4" r="2.4" fill="#EF8163" />
      <circle cx="11" cy="9" r="2" fill="#5B8DEF" />
      <circle cx="4" cy="11" r="2" fill="#43A883" />
    </svg>
  ),
  timeline: () => (
    <svg className="relative shrink-0" width="15" height="15" viewBox="0 0 15 15">
      <line x1="1" y1="12" x2="14" y2="12" stroke="#6E7480" strokeWidth="1.2" />
      <circle cx="4" cy="6" r="2.6" fill="none" stroke="#7C9CF0" strokeWidth="1.3" />
      <circle cx="10.5" cy="5" r="3.2" fill="none" stroke="#E9A15F" strokeWidth="1.3" />
    </svg>
  ),
  activity: () => (
    <span className="relative flex shrink-0 flex-col" style={{ width: 14, gap: "2.5px" }}>
      <span style={{ height: "1.5px", background: "#6e7480" }} />
      <span style={{ height: "1.5px", width: "70%", background: "#6e7480" }} />
      <span style={{ height: "1.5px", background: "#6e7480" }} />
    </span>
  ),
} as const;

type IconName = keyof typeof NavIcons;

interface NavItem {
  href: string;
  icon: IconName;
  label: string;
  color?: string;
  tint: keyof typeof TINT;
  count?: number;
}

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
      items: [{ href: "/dashboard", icon: "dashboard", label: t("nav.dashboard"), tint: "neutral" }],
    },
    {
      title: t("nav.entities"),
      items: [
        { href: "/contacts", icon: "people", label: t("dashboard.tab.contacts"), count: counts.contacts, color: "#EF8163", tint: "people" },
        { href: "/companies", icon: "companies", label: t("dashboard.tab.companies"), count: counts.companies, color: "#43A883", tint: "companies" },
        { href: "/communities", icon: "communities", label: t("dashboard.tab.communities"), count: counts.communities, color: "#9B7BE0", tint: "communities" },
        { href: "/network", icon: "connections", label: t("nav.connections"), count: counts.connections, color: "#5B8DEF", tint: "connections" },
      ],
    },
    {
      title: t("nav.network"),
      items: [
        { href: "/network", icon: "graph", label: t("dashboard.tab.graph"), tint: "neutral" },
        { href: "/timeline", icon: "timeline", label: t("dashboard.tab.timeline"), tint: "timeline" },
      ],
    },
    {
      title: t("nav.activity"),
      items: [{ href: "/activity", icon: "activity", label: t("nav.followUps"), tint: "neutral" }],
    },
  ];

  const navContent = (
    <>
      {/* Brand — dark tile with the three accent dots, wordmark + mono kicker */}
      <Link
        href="/dashboard"
        className="flex items-center gap-2.5 px-2"
        onClick={() => setIsMobileOpen(false)}
      >
        <span
          className="relative flex-none"
          style={{ width: 26, height: 26, borderRadius: 9, background: "#1b1d21" }}
        >
          <span className="absolute rounded-full" style={{ left: 6, top: 6, width: 6, height: 6, background: "#ef8163" }} />
          <span className="absolute rounded-full" style={{ right: 6, top: 7, width: 5, height: 5, background: "#5b8def" }} />
          <span className="absolute rounded-full" style={{ left: 9, bottom: 5, width: 5, height: 5, background: "#9b7be0" }} />
        </span>
        <span>
          <span className="block text-[14px] font-semibold tracking-[-0.2px] text-foreground">
            {t("nav.brand")}
          </span>
          <span className="kicker block" style={{ fontSize: "9.5px", color: "#9a9a94", letterSpacing: "0.06em" }}>
            {t("nav.brandKicker")}
          </span>
        </span>
      </Link>

      <nav className="flex flex-1 flex-col gap-[22px] overflow-y-auto">
        {sections.map((section) => (
          <div key={section.title} className="flex flex-col gap-[3px]">
            <div className="kicker" style={{ padding: "0 8px 6px" }}>
              {section.title}
            </div>
            {section.items.map((item) => {
              const isActive = pathname === item.href;
              const Icon = NavIcons[item.icon];
              const tint = TINT[item.tint];
              return (
                <Link
                  key={`${section.title}-${item.href}-${item.label}`}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className="group relative flex items-center gap-[9px] rounded-[9px] px-2.5 py-2 text-[13px] font-medium text-[#3a3c42] transition-colors hover:bg-[#f4f4f1]"
                >
                  {isActive && (
                    <span
                      className="absolute inset-0 rounded-[9px]"
                      style={{ background: tint.bg, border: `1px solid ${tint.border}` }}
                    />
                  )}
                  <Icon color={item.color} />
                  <span className="relative flex-1 truncate">{item.label}</span>
                  {item.count != null && (
                    <span className="relative font-mono text-[10px] text-[#9a9a94]">{item.count}</span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer — user card, then the settings / language / sign-out controls */}
      <div className="mt-auto flex flex-col gap-2">
        {userEmail && (
          <div
            className="flex items-center gap-[9px] rounded-[11px] px-2.5 py-2.5"
            style={{ background: "#f7f7f4", border: "1px solid #edece8" }}
          >
            <span
              className="flex flex-none items-center justify-center rounded-full text-[11px] font-semibold uppercase text-[#6e7480]"
              style={{ width: 26, height: 26, background: "#e2e1db" }}
            >
              {userEmail.charAt(0)}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[12px] font-semibold text-foreground">{userEmail}</div>
              <div className="text-[10.5px] text-[#9a9a94]">{t("nav.myNetwork")}</div>
            </div>
          </div>
        )}
        <div className="flex items-center gap-1.5 px-0.5">
          <Link
            href="/settings"
            title={t("nav.settings")}
            onClick={() => setIsMobileOpen(false)}
            className="flex size-7 items-center justify-center rounded-[8px] border border-[#edece8] bg-card text-[#9a9a94] transition-colors hover:text-foreground"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.4" />
              <path
                d="M8 1.5v1.4M8 13.1v1.4M14.5 8h-1.4M2.9 8H1.5M12.6 3.4l-1 1M4.4 11.6l-1 1M12.6 12.6l-1-1M4.4 4.4l-1-1"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </Link>
          <LanguageSwitcher />
          {signOutButton}
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar — height pinned so full-bleed screens can subtract it. */}
      <div className="flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-xl lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <span className="relative flex-none" style={{ width: 24, height: 24, borderRadius: 8, background: "#1b1d21" }}>
            <span className="absolute rounded-full" style={{ left: 5, top: 5, width: 6, height: 6, background: "#ef8163" }} />
            <span className="absolute rounded-full" style={{ right: 5, top: 6, width: 5, height: 5, background: "#5b8def" }} />
            <span className="absolute rounded-full" style={{ left: 8, bottom: 4, width: 5, height: 5, background: "#9b7be0" }} />
          </span>
          <span className="text-[14px] font-semibold tracking-[-0.2px] text-foreground">{t("nav.brand")}</span>
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
          <div className="absolute inset-y-0 left-0 flex w-64 max-w-[85vw] flex-col gap-[22px] bg-sidebar px-3.5 py-5 shadow-2xl">
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
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-60 lg:flex-col lg:gap-[22px] lg:border-r lg:border-sidebar-border lg:bg-sidebar lg:px-3.5 lg:py-5">
        {navContent}
      </aside>
    </>
  );
}
