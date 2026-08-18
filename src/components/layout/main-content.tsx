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

  // pl matches the desktop sidebar's own lg:w-60 exactly; a wider pad would
  // leave a dead gutter on the very screens that need the room most.
  if (matches(pathname, BLEED_ROUTES)) {
    // Below lg the sidebar renders an in-flow h-14 top bar above this element,
    // so a full 100svh here would push the bottom of the screen out of reach.
    return <main className="h-[calc(100svh-3.5rem)] w-full overflow-hidden lg:h-svh lg:pl-60">{children}</main>;
  }

  const wide = matches(pathname, WIDE_ROUTES);
  return <main className={`w-full py-5 lg:pl-60 ${wide ? "px-4 sm:px-6" : "mx-auto max-w-7xl px-4 sm:px-6"}`}>{children}</main>;
}
