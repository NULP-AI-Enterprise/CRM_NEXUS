import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/rate-limit";

type RouteContext = { params: Promise<{ id: string }> };

/** Revokes an OAuth client and everything it ever issued — not just the
 * client row itself. Without cascading to its refresh tokens and access
 * tokens, revoking here would only hide the client from the list while
 * Claude kept silently refreshing and minting fresh ApiKey rows, giving a
 * false sense of having disconnected it. */
export async function DELETE(request: Request, { params }: RouteContext) {
  const rl = checkRateLimit("apiGeneral", getClientIp(request.headers));
  if (rl.limited) return rateLimitedResponse(rl.retryAfterSeconds);

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.oAuthClient.findFirst({ where: { id, userId: session.user.id } });
  if (!existing) {
    return NextResponse.json({ error: "OAuth client not found." }, { status: 404 });
  }

  const revokedAt = new Date();
  await prisma.$transaction([
    prisma.oAuthClient.update({ where: { id }, data: { revokedAt } }),
    prisma.oAuthRefreshToken.deleteMany({ where: { clientId: id } }),
    prisma.apiKey.updateMany({ where: { oauthClientId: id }, data: { revokedAt } }),
  ]);

  return NextResponse.json({ success: true });
}
