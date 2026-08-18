import { redirect, notFound } from "next/navigation";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";

import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin/is-admin";

/** For Server Component pages/layouts under src/app/admin/**. notFound()
 *  (not a 403) for a signed-in non-admin, so the route's existence isn't
 *  confirmed to someone probing it. Called independently on every admin
 *  page, not just the layout — defense in depth, since a page could in
 *  principle be reached without its layout re-running in some render paths. */
export async function requireAdminPage(): Promise<Session> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isAdmin(session)) notFound();
  return session;
}

/** For Route Handlers under src/app/api/admin/**, where redirect()/notFound()
 *  don't apply — the caller returns `result.error` directly when present. */
export async function requireAdminApi(): Promise<{ session: Session } | { error: NextResponse }> {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!isAdmin(session)) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  return { session };
}
