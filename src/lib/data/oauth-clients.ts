import { prisma } from "@/lib/prisma";

const OAUTH_CLIENT_SUMMARY_SELECT = {
  id: true,
  name: true,
  clientId: true,
  revokedAt: true,
  createdAt: true,
  accessTokens: {
    select: { lastUsedAt: true },
    orderBy: { lastUsedAt: { sort: "desc", nulls: "last" } },
    take: 1,
  },
} as const;

export type OAuthClientSummary = Awaited<ReturnType<typeof listOAuthClients>>[number];

/** Never selects `clientSecretHash` — nothing beyond auth resolution needs it
 * in memory. `accessTokens` is trimmed to just the most-recently-used token
 * so the UI can show "last used" without listing every rotated access token
 * this client has ever minted. */
export function listOAuthClients(userId: string) {
  return prisma.oAuthClient.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: OAUTH_CLIENT_SUMMARY_SELECT,
  });
}
