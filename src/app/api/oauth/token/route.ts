import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { generateApiKey, hashApiKey } from "@/lib/mcp/auth";
import { generateRefreshToken, verifyPkce } from "@/lib/mcp/oauth";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/rate-limit";
import type { ApiKeyScope } from "@/generated/prisma/enums";
import type { OAuthClientModel } from "@/generated/prisma/models";

const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

function oauthError(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function tokenResponse(rawAccessToken: string, refreshToken: string, scope: ApiKeyScope) {
  return NextResponse.json({
    access_token: rawAccessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL_MS / 1000,
    refresh_token: refreshToken,
    scope,
  });
}

async function authenticateClient(clientId: unknown, clientSecret: unknown): Promise<OAuthClientModel | null> {
  if (typeof clientId !== "string" || typeof clientSecret !== "string") return null;
  const client = await prisma.oAuthClient.findUnique({ where: { clientId } });
  if (!client || client.revokedAt) return null;
  if (hashApiKey(clientSecret) !== client.clientSecretHash) return null;
  return client;
}

export async function POST(request: Request) {
  const rl = checkRateLimit("oauthToken", getClientIp(request.headers));
  if (rl.limited) return rateLimitedResponse(rl.retryAfterSeconds);

  const form = await request.formData();
  const grantType = form.get("grant_type");

  const client = await authenticateClient(form.get("client_id"), form.get("client_secret"));
  if (!client) return oauthError("invalid_client", 401);

  if (grantType === "authorization_code") {
    const code = form.get("code");
    const redirectUri = form.get("redirect_uri");
    const codeVerifier = form.get("code_verifier");
    if (typeof code !== "string" || typeof redirectUri !== "string" || typeof codeVerifier !== "string") {
      return oauthError("invalid_request");
    }

    // The delete itself is the single-use gate — atomic, so a concurrent
    // second redemption of the same code can never race past this point.
    // Every subsequent check runs against the row this delete returned,
    // never a prior lookup. A code that fails validation here is still
    // burned (not restored) — deliberate, since it's short-lived (10 min)
    // and a tampered replay attempt shouldn't get a second try.
    let redeemed;
    try {
      redeemed = await prisma.oAuthAuthorizationCode.delete({ where: { code } });
    } catch {
      return oauthError("invalid_grant");
    }

    if (
      redeemed.expiresAt < new Date() ||
      redeemed.clientId !== client.id ||
      redeemed.redirectUri !== redirectUri ||
      !verifyPkce(codeVerifier, redeemed.codeChallenge)
    ) {
      return oauthError("invalid_grant");
    }

    const { rawKey, keyHash, keyPreview } = generateApiKey();
    const refreshToken = generateRefreshToken();

    await prisma.$transaction([
      prisma.apiKey.create({
        data: {
          name: client.name,
          keyHash,
          keyPreview,
          scope: redeemed.scope,
          redactSensitive: redeemed.redactSensitive,
          expiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_MS),
          userId: redeemed.userId,
          oauthClientId: client.id,
        },
      }),
      prisma.oAuthRefreshToken.create({
        data: {
          token: refreshToken,
          scope: redeemed.scope,
          redactSensitive: redeemed.redactSensitive,
          expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
          clientId: client.id,
          userId: redeemed.userId,
        },
      }),
    ]);

    return tokenResponse(rawKey, refreshToken, redeemed.scope);
  }

  if (grantType === "refresh_token") {
    const refreshTokenValue = form.get("refresh_token");
    if (typeof refreshTokenValue !== "string") return oauthError("invalid_request");

    try {
      // One interactive transaction: delete-as-gate, then validate, then
      // mint the replacement pair — all-or-nothing. Unlike the authorization
      // code above, an invalid/expired presentation here rolls the delete
      // back too (thrown error aborts the transaction), leaving the caller's
      // existing refresh token intact rather than burned-with-no-replacement.
      // A DB failure during the creates rolls back the same way, so a failed
      // rotation never stops a still-legitimately-connected client.
      const result = await prisma.$transaction(async (tx) => {
        const old = await tx.oAuthRefreshToken.delete({ where: { token: refreshTokenValue } });
        if (old.expiresAt < new Date() || old.clientId !== client.id) {
          throw new Error("invalid_grant");
        }

        const { rawKey, keyHash, keyPreview } = generateApiKey();
        const newRefreshToken = generateRefreshToken();

        await tx.apiKey.create({
          data: {
            name: client.name,
            keyHash,
            keyPreview,
            scope: old.scope,
            redactSensitive: old.redactSensitive,
            expiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_MS),
            userId: old.userId,
            oauthClientId: client.id,
          },
        });
        await tx.oAuthRefreshToken.create({
          data: {
            token: newRefreshToken,
            scope: old.scope,
            redactSensitive: old.redactSensitive,
            expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
            clientId: client.id,
            userId: old.userId,
          },
        });

        return { rawKey, newRefreshToken, scope: old.scope };
      });

      return tokenResponse(result.rawKey, result.newRefreshToken, result.scope);
    } catch {
      return oauthError("invalid_grant");
    }
  }

  return oauthError("unsupported_grant_type");
}
