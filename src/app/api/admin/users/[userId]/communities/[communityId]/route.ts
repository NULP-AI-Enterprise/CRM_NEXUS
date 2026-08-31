import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/rate-limit";
import { communityInputSchema, updateField } from "@/lib/validation/community";
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

  // .partial(): the admin dialog only sends name/description today, so a
  // full (non-partial) parse would silently null out every other field on
  // every save — same fix as the public community route.
  const parsed = communityInputSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  if (parsed.data.name !== undefined) {
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
  }

  const community = await prisma.community.update({
    where: { id: communityId },
    data: {
      name: parsed.data.name,
      description: updateField(parsed.data.description),
      linkedin: updateField(parsed.data.linkedin),
      phone: updateField(parsed.data.phone),
      city: updateField(parsed.data.city),
      country: updateField(parsed.data.country),
      usefulnessScore: updateField(parsed.data.usefulnessScore),
      needs: updateField(parsed.data.needs),
      valuePotential: updateField(parsed.data.valuePotential),
      fullSummary: updateField(parsed.data.fullSummary),
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
