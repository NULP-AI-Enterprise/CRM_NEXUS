import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/rate-limit";
import { communityInputSchema } from "@/lib/validation/community";
import { requireAdminApi } from "@/lib/admin/require-admin";
import { logAdminAction } from "@/lib/admin/audit-log";

type RouteContext = { params: Promise<{ userId: string; communityId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const rl = checkRateLimit("adminWrite", getClientIp(request.headers));
  if (rl.limited) return rateLimitedResponse(rl.retryAfterSeconds);

  const result = await requireAdminApi();
  if ("error" in result) return result.error;
  const { session } = result;

  const { userId, communityId } = await params;
  const existing = await prisma.community.findFirst({ where: { id: communityId, userId } });
  if (!existing) {
    return NextResponse.json({ error: "Community not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = communityInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  const duplicate = await prisma.community.findFirst({
    where: {
      userId,
      id: { not: communityId },
      name: { equals: parsed.data.name, mode: "insensitive" },
    },
  });
  if (duplicate) {
    return NextResponse.json({ error: "duplicate" }, { status: 409 });
  }

  const community = await prisma.community.update({
    where: { id: communityId },
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
    },
  });

  await logAdminAction({
    adminUserId: session.user.id,
    targetUserId: userId,
    entityType: "Community",
    entityId: community.id,
    action: "update",
  });

  return NextResponse.json({ community });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const rl = checkRateLimit("adminWrite", getClientIp(request.headers));
  if (rl.limited) return rateLimitedResponse(rl.retryAfterSeconds);

  const result = await requireAdminApi();
  if ("error" in result) return result.error;
  const { session } = result;

  const { userId, communityId } = await params;
  const existing = await prisma.community.findFirst({ where: { id: communityId, userId } });
  if (!existing) {
    return NextResponse.json({ error: "Community not found." }, { status: 404 });
  }

  await prisma.community.delete({ where: { id: communityId } });

  await logAdminAction({
    adminUserId: session.user.id,
    targetUserId: userId,
    entityType: "Community",
    entityId: communityId,
    action: "delete",
  });

  return NextResponse.json({ success: true });
}
