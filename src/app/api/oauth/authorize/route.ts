import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAllowedRedirectUri, generateAuthorizationCode } from "@/lib/mcp/oauth";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/rate-limit";
import type { ApiKeyScope } from "@/generated/prisma/enums";

const CODE_TTL_MS = 10 * 60 * 1000;

/** Handles the Allow/Deny submission from the consent screen
 * (src/app/(oauth)/authorize/page.tsx). Re-validates every field from
 * scratch — a form POST here is untrusted input regardless of what the GET
 * page rendered. */
export async function POST(request: Request) {
  const rl = checkRateLimit("apiGeneral", getClientIp(request.headers));
  if (rl.limited) return rateLimitedResponse(rl.retryAfterSeconds);

  const form = await request.formData();
  const clientId = form.get("client_id");
  const redirectUri = form.get("redirect_uri");
  const codeChallenge = form.get("code_challenge");
  const codeChallengeMethod = form.get("code_challenge_method");
  const state = form.get("state");
  const decision = form.get("decision");
  const scope = form.get("scope");
  const redactSensitive = form.get("redactSensitive") === "true";

  // redirect_uri is validated in isolation first — everything after this
  // point is allowed to redirect back to it on failure.
  if (typeof redirectUri !== "string" || !isAllowedRedirectUri(redirectUri)) {
    return NextResponse.json({ error: "invalid_redirect_uri" }, { status: 400 });
  }

  const bounce = (error: string) => {
    const url = new URL(redirectUri);
    url.searchParams.set("error", error);
    if (typeof state === "string" && state) url.searchParams.set("state", state);
    // 303 (not the 307 NextResponse.redirect defaults to) — this handler is
    // a POST (the consent form submission), and an OAuth redirect_uri
    // callback expects a plain GET with code/state in the query string. A
    // 307 preserves the original method, so the client's callback would
    // receive a POST instead and reject it ("Method Not Allowed").
    return NextResponse.redirect(url, 303);
  };

  if (
    typeof clientId !== "string" ||
    typeof codeChallenge !== "string" ||
    codeChallengeMethod !== "S256" ||
    (scope !== "READ" && scope !== "READ_WRITE")
  ) {
    return bounce("invalid_request");
  }

  const client = await prisma.oAuthClient.findUnique({ where: { clientId } });
  if (!client || client.revokedAt) {
    return bounce("invalid_client");
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (decision !== "allow") {
    return bounce("access_denied");
  }

  const code = generateAuthorizationCode();
  await prisma.oAuthAuthorizationCode.create({
    data: {
      code,
      clientId: client.id,
      userId: session.user.id,
      redirectUri,
      scope: scope as ApiKeyScope,
      redactSensitive,
      codeChallenge,
      codeChallengeMethod,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });

  const url = new URL(redirectUri);
  url.searchParams.set("code", code);
  if (typeof state === "string" && state) url.searchParams.set("state", state);
  return NextResponse.redirect(url, 303);
}
