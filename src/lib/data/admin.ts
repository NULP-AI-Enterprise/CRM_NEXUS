import { prisma } from "@/lib/prisma";

/** Cross-user queries for the admin panel — deliberately UNSCOPED (no
 *  implicit userId filter), unlike everything else in src/lib/data/, where
 *  every other function takes a userId to fetch that one user's own rows.
 *  Restricted to src/app/admin/** by an eslint no-restricted-imports rule
 *  (see eslint.config.mjs) — importing this file elsewhere is a lint error.
 *  Once a specific target user is known, admin pages call the existing
 *  per-user functions (listContacts, getCompaniesWithContacts, etc.)
 *  directly with that user's id — no admin-specific duplicates needed.
 *  Never selects passwordHash, mirroring the existing rule against ever
 *  selecting ApiKey.keyHash. */

export interface AdminUserSummary {
  id: string;
  email: string;
  name: string | null;
  emailVerified: Date | null;
  createdAt: Date;
  contactCount: number;
  companyCount: number;
  communityCount: number;
}

export async function adminListUsers(): Promise<AdminUserSummary[]> {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      emailVerified: true,
      createdAt: true,
      _count: { select: { contacts: true, companies: true, communities: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    emailVerified: u.emailVerified,
    createdAt: u.createdAt,
    contactCount: u._count.contacts,
    companyCount: u._count.companies,
    communityCount: u._count.communities,
  }));
}

export interface AdminUserProfile {
  id: string;
  email: string;
  name: string | null;
  emailVerified: Date | null;
  createdAt: Date;
}

export async function adminGetUserProfile(userId: string): Promise<AdminUserProfile | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, emailVerified: true, createdAt: true },
  });
}
