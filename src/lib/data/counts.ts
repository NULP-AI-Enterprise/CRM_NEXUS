import { prisma } from "@/lib/prisma";

export interface EntityCounts {
  contacts: number;
  companies: number;
  communities: number;
  connections: number;
}

/** Cheap counts for the sidebar nav — plain .count() calls, not the heavier
 * nested-include loaders the actual list pages use. */
export async function getEntityCounts(userId: string): Promise<EntityCounts> {
  const [contacts, companies, communities, connections] = await Promise.all([
    prisma.contact.count({ where: { userId } }),
    prisma.company.count({ where: { userId } }),
    prisma.community.count({ where: { userId } }),
    prisma.contactConnection.count({ where: { userId } }),
  ]);

  return { contacts, companies, communities, connections };
}
