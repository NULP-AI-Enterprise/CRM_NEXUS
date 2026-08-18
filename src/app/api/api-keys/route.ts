import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateApiKey } from "@/lib/mcp/auth";
import { ApiKeyScope } from "@/generated/prisma/enums";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/rate-limit";

const apiKeyInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  scope: z.nativeEnum(ApiKeyScope).default("READ"),
  redactSensitive: z.boolean().default(true),
  expiresInDays: z.union([z.literal(90), z.literal(365)]).nullable().default(null),
});

export async function POST(request: Request) {
  const rl = checkRateLimit("apiGeneral", getClientIp(request.headers));
  if (rl.limited) return rateLimitedResponse(rl.retryAfterSeconds);

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = apiKeyInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  const { name, scope, redactSensitive, expiresInDays } = parsed.data;
  const { rawKey, keyHash, keyPreview } = generateApiKey();
  const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null;

  const apiKey = await prisma.apiKey.create({
    data: { userId: session.user.id, name, scope, redactSensitive, expiresAt, keyHash, keyPreview },
    select: {
      id: true,
      name: true,
      keyPreview: true,
      scope: true,
      redactSensitive: true,
      expiresAt: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });

  // rawKey is returned exactly this once — it is never stored or logged in plaintext.
  return NextResponse.json({ apiKey, rawKey }, { status: 201 });
}
