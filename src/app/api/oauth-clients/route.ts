import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateOAuthClientCredentials } from "@/lib/mcp/oauth";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/rate-limit";

const oauthClientInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
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

  const parsed = oauthClientInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const { clientId, rawClientSecret, clientSecretHash } = generateOAuthClientCredentials();

  const client = await prisma.oAuthClient.create({
    data: { userId: session.user.id, name: parsed.data.name, clientId, clientSecretHash },
    select: { id: true, name: true, clientId: true, revokedAt: true, createdAt: true },
  });

  // clientSecret is returned exactly this once — it is never stored or logged in plaintext.
  return NextResponse.json({ client, clientSecret: rawClientSecret }, { status: 201 });
}
