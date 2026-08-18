import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/rate-limit";

type RouteContext = { params: Promise<{ id: string }> };

/** Revokes (soft-deletes) an API key. The row is kept, not removed, so a
 * revoked key can still be rejected by id forever rather than becoming
 * silently "unknown" and indistinguishable from one that never existed. */
export async function DELETE(request: Request, { params }: RouteContext) {
  const rl = checkRateLimit("apiGeneral", getClientIp(request.headers));
  if (rl.limited) return rateLimitedResponse(rl.retryAfterSeconds);

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.apiKey.findFirst({ where: { id, userId: session.user.id } });
  if (!existing) {
    return NextResponse.json({ error: "API key not found." }, { status: 404 });
  }

  await prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });

  return NextResponse.json({ success: true });
}
