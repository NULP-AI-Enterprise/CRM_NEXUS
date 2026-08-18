import type { Session } from "next-auth";

/** Admin identity lives in an env var, never a DB column: a column is
 *  reachable by any future code path that updates a User row, so
 *  self-escalation is only ever prevented by code-review discipline. An env
 *  var cannot be written by any HTTP-reachable route, making self-escalation
 *  structurally impossible — the same trust model this app already uses for
 *  AUTH_SECRET/OPENAI_API_KEY. */
export function isAdmin(session: Session | null): boolean {
  const email = session?.user?.email;
  if (!email) return false;

  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return adminEmails.includes(email.toLowerCase());
}
