import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/rate-limit";
import { communityInputSchema, updateField } from "@/lib/validation/community";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const rl = checkRateLimit("apiGeneral", getClientIp(request.headers));
  if (rl.limited) return rateLimitedResponse(rl.retryAfterSeconds);

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.community.findFirst({ where: { id, userId: session.user.id } });
  if (!existing) {
    return NextResponse.json({ error: "Community not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // .partial(): an inline single-field edit must not wipe the other field —
  // see the identical comment on the contacts route.
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
        userId: session.user.id,
        id: { not: id },
        name: { equals: parsed.data.name, mode: "insensitive" },
      },
    });
    if (duplicate) {
      return NextResponse.json({ error: "duplicate" }, { status: 409 });
    }
  }

  const community = await prisma.community.update({
    where: { id },
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

  return NextResponse.json({ community });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const rl = checkRateLimit("apiGeneral", getClientIp(request.headers));
  if (rl.limited) return rateLimitedResponse(rl.retryAfterSeconds);

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.community.findFirst({ where: { id, userId: session.user.id } });
  if (!existing) {
    return NextResponse.json({ error: "Community not found." }, { status: 404 });
  }

  await prisma.community.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
