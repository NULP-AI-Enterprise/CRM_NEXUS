import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { InteractionType } from "@/generated/prisma/enums";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/rate-limit";
import { interactionOwnerConditions } from "@/lib/data/interaction-ownership";

const logInteractionSchema = z.object({
  rawText: z.string().trim().min(1).max(8000),
  type: z.nativeEnum(InteractionType).default("MEMO"),
  followUp: z.string().trim().max(2000).nullish(),
  followUpDate: z.string().date().nullish(),
  createdAt: z.string().datetime().nullish(),
  parentInteractionId: z.string().min(1).nullish(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const rl = checkRateLimit("apiGeneral", getClientIp(request.headers));
  if (rl.limited) return rateLimitedResponse(rl.retryAfterSeconds);

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const company = await prisma.company.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!company) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = logInteractionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  // A branch's parent just has to be one of the user's own interactions, not
  // necessarily on this same company — that's what lets a provenance chain
  // cross entities (X introduces Y; Y's first event branches off X's).
  let validParentId: string | null = null;
  if (parsed.data.parentInteractionId) {
    const parent = await prisma.interaction.findFirst({
      where: { id: parsed.data.parentInteractionId, OR: interactionOwnerConditions(session.user.id) },
      select: { id: true },
    });
    validParentId = parent?.id ?? null;
  }

  const interaction = await prisma.interaction.create({
    data: {
      companyId: company.id,
      type: parsed.data.type,
      rawText: parsed.data.rawText,
      followUp: parsed.data.followUp || null,
      followUpDate: parsed.data.followUpDate ? new Date(parsed.data.followUpDate) : null,
      createdAt: parsed.data.createdAt ? new Date(parsed.data.createdAt) : undefined,
      parentInteractionId: validParentId,
    },
  });

  return NextResponse.json({ interaction }, { status: 201 });
}
