import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/rate-limit";
import { communityInputSchema } from "@/lib/validation/community";
import { requireAdminApi } from "@/lib/admin/require-admin";
import { logAdminAction } from "@/lib/admin/audit-log";

type RouteContext = { params: Promise<{ userId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const rl = checkRateLimit("adminWrite", getClientIp(request.headers));
  if (rl.limited) return rateLimitedResponse(rl.retryAfterSeconds);

  const result = await requireAdminApi();
  if ("error" in result) return result.error;
  const { session } = result;

  const { userId } = await params;

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

  const existing = await prisma.community.findFirst({
    where: { userId, name: { equals: parsed.data.name, mode: "insensitive" } },
  });
  if (existing) {
    return NextResponse.json({ error: "duplicate" }, { status: 409 });
  }

  const community = await prisma.community.create({
    data: {
      userId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      linkedin: parsed.data.linkedin || null,
      phone: parsed.data.phone || null,
      city: parsed.data.city || null,
      country: parsed.data.country || null,
      usefulnessScore: parsed.data.usefulnessScore ?? null,
      needs: parsed.data.needs || null,
      valuePotential: parsed.data.valuePotential || null,
      fullSummary: parsed.data.fullSummary || null,
    },
  });

  await logAdminAction({
    adminUserId: session.user.id,
    targetUserId: userId,
    entityType: "Community",
    entityId: community.id,
    action: "create",
  });

  return NextResponse.json({ community }, { status: 201 });
}
