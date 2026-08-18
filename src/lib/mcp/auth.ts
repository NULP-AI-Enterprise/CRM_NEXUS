import crypto from "crypto";

import { prisma } from "@/lib/prisma";
import type { ApiKeyScope } from "@/generated/prisma/enums";

const KEY_PREFIX = "nxs_";

export function generateApiKey(): { rawKey: string; keyHash: string; keyPreview: string } {
  const rawKey = KEY_PREFIX + crypto.randomBytes(32).toString("hex");
  return { rawKey, keyHash: hashApiKey(rawKey), keyPreview: rawKey.slice(-4) };
}

export function hashApiKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

export interface McpAuthContext {
  userId: string;
  apiKeyId: string;
  scope: ApiKeyScope;
  redactSensitive: boolean;
}

/** Resolves an MCP request's Bearer key to the user it belongs to, or null if
 * the key is missing, malformed, unknown, revoked, or expired. Every MCP tool
 * must derive `userId` from this — never from a client-supplied argument. */
export async function resolveApiKeyContext(request: Request): Promise<McpAuthContext | null> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const rawKey = header.slice("Bearer ".length).trim();
  if (!rawKey) return null;

  const apiKey = await prisma.apiKey.findUnique({ where: { keyHash: hashApiKey(rawKey) } });
  if (!apiKey) return null;
  if (apiKey.revokedAt) return null;
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

  await prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } });

  return {
    userId: apiKey.userId,
    apiKeyId: apiKey.id,
    scope: apiKey.scope,
    redactSensitive: apiKey.redactSensitive,
  };
}
