import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/rate-limit";
import { requireAdminApi } from "@/lib/admin/require-admin";
import { logAdminAction } from "@/lib/admin/audit-log";

type RouteContext = { params: Promise<{ userId: string; connectionId: string }> };

/** Delete-only: creating/editing a connection needs a two-contact picker UI
 *  that's out of scope for this admin panel's first pass — moderating a bad
 *  connection (the actual ask) only needs delete. */
export async function DELETE(request: Request, { params }: RouteContext) {
  const rl = checkRateLimit("adminWrite", getClientIp(request.headers));
  if (rl.limited) return rateLimitedResponse(rl.retryAfterSeconds);

  const result = await requireAdminApi();
  if ("error" in result) return result.error;
  const { session } = result;

  const { userId, connectionId } = await params;
  const existing = await prisma.contactConnection.findFirst({ where: { id: connectionId, userId } });
  if (!existing) {
    return NextResponse.json({ error: "Connection not found." }, { status: 404 });
  }

  await prisma.contactConnection.delete({ where: { id: connectionId } });

  await logAdminAction({
    adminUserId: session.user.id,
    targetUserId: userId,
    entityType: "ContactConnection",
    entityId: connectionId,
    action: "delete",
  });

  return NextResponse.json({ success: true });
}
