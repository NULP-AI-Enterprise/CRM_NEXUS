import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/rate-limit";

const logInteractionSchema = z.object({
  rawText: z.string().trim().min(1).max(8000),
  followUp: z.string().trim().max(2000).nullish(),
  followUpDate: z.string().date().nullish(),
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
  const connection = await prisma.contactConnection.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!connection) {
    return NextResponse.json({ error: "Connection not found." }, { status: 404 });
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
  // necessarily on this same connection — that's what lets a provenance
  // chain cross entities (X introduces Y; Y's first event branches off X's).
  let validParentId: string | null = null;
  if (parsed.data.parentInteractionId) {
    const parent = await prisma.interaction.findFirst({
      where: { id: parsed.data.parentInteractionId, OR: [{ contact: { userId: session.user.id } }, { connection: { userId: session.user.id } }] },
      select: { id: true },
    });
    validParentId = parent?.id ?? null;
  }

  const interaction = await prisma.interaction.create({
    data: {
      connectionId: connection.id,
      type: "MEMO",
      rawText: parsed.data.rawText,
      followUp: parsed.data.followUp || null,
      followUpDate: parsed.data.followUpDate ? new Date(parsed.data.followUpDate) : null,
      parentInteractionId: validParentId,
    },
  });

  return NextResponse.json({ interaction }, { status: 201 });
}
