import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/rate-limit";

const logInteractionSchema = z.object({
  rawText: z.string().trim().min(1).max(8000),
  followUp: z.string().trim().max(2000).nullish(),
  followUpDate: z.string().date().nullish(),
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

  const interaction = await prisma.interaction.create({
    data: {
      connectionId: connection.id,
      type: "NOTE",
      rawText: parsed.data.rawText,
      followUp: parsed.data.followUp || null,
      followUpDate: parsed.data.followUpDate ? new Date(parsed.data.followUpDate) : null,
    },
  });

  return NextResponse.json({ interaction }, { status: 201 });
}
