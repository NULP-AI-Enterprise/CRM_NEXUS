import { prisma } from "@/lib/prisma";

/** Written on every admin write, never on reads (that would be pure noise
 *  for a personal-CRM-scale audit trail). No viewer UI yet — query via
 *  Prisma Studio. */
export async function logAdminAction(params: {
  adminUserId: string;
  targetUserId: string;
  entityType: string;
  entityId: string;
  action: "create" | "update" | "delete";
}): Promise<void> {
  await prisma.adminAuditLog.create({ data: params });
}
