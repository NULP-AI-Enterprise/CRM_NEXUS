"use client";

import { usePathname } from "next/navigation";

// Three layout modes, by route:
//  - "reading" (default): capped width, comfortable page padding.
//  - "wide": full available width, still padded — for a canvas that benefits
//    from room but is still one element among others on the page.
//  - "bleed": no padding, exactly one viewport tall, page never scrolls — for
//    screens that ARE the whole app surface and manage their own internal
//    scrolling (the History graph's sidebar / canvas / detail-panel shell).
// Kept as explicit allow-lists rather than inverted, so new pages default to
// the safest layout.
const BLEED_ROUTES = ["/timeline"];
const WIDE_ROUTES = ["/network"];

function matches(pathname: string, routes: string[]): boolean {
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function MainContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (matches(pathname, BLEED_ROUTES)) {
    return <main className="h-[calc(100svh-3.5rem)] w-full overflow-hidden lg:h-svh lg:pl-[236px]">{children}</main>;
  }

  const wide = matches(pathname, WIDE_ROUTES);
  // Match template: max-width 1004px for the main content area, padding 32px 42px
  return (
    <main className={`w-full py-[32px] lg:pl-[236px] ${wide ? "px-[42px]" : "mx-auto max-w-[1240px] px-[42px]"}`}>
      <div className="flex flex-col gap-[32px]">{children}</div>
    </main>
  );
}
