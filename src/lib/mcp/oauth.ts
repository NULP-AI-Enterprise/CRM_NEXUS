import crypto from "crypto";

import { hashApiKey } from "@/lib/mcp/auth";

/** Claude's web connector's OAuth redirect URIs — the only real consumer of
 * this authorization server today, so this is a hardcoded allowlist rather
 * than per-client custom redirect URIs. */
export const ALLOWED_REDIRECT_URIS = [
  "https://claude.ai/api/mcp/auth_callback",
  "https://claude.com/api/mcp/auth_callback",
] as const;

export function isAllowedRedirectUri(uri: string): boolean {
  return (ALLOWED_REDIRECT_URIS as readonly string[]).includes(uri);
}

const CLIENT_ID_PREFIX = "nxc_";
const CLIENT_SECRET_PREFIX = "nxcs_";

export function generateOAuthClientCredentials(): {
  clientId: string;
  rawClientSecret: string;
  clientSecretHash: string;
} {
  const clientId = CLIENT_ID_PREFIX + crypto.randomBytes(16).toString("hex");
  const rawClientSecret = CLIENT_SECRET_PREFIX + crypto.randomBytes(32).toString("hex");
  return { clientId, rawClientSecret, clientSecretHash: hashApiKey(rawClientSecret) };
}

export function generateAuthorizationCode(): string {
  return "nxac_" + crypto.randomBytes(32).toString("hex");
}

export function generateRefreshToken(): string {
  return "nxrt_" + crypto.randomBytes(32).toString("hex");
}

/** PKCE (S256 only — the MCP OAuth profile mandates it, no `plain` fallback). */
export function verifyPkce(codeVerifier: string, codeChallenge: string): boolean {
  const computed = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
  return computed === codeChallenge;
}
