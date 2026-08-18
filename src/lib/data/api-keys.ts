import { prisma } from "@/lib/prisma";

const API_KEY_SUMMARY_SELECT = {
  id: true,
  name: true,
  keyPreview: true,
  scope: true,
  redactSensitive: true,
  expiresAt: true,
  lastUsedAt: true,
  revokedAt: true,
  createdAt: true,
} as const;

export type ApiKeySummary = Awaited<ReturnType<typeof listApiKeys>>[number];

/** Never selects `keyHash` — nothing beyond auth resolution needs it in memory. */
export function listApiKeys(userId: string) {
  return prisma.apiKey.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: API_KEY_SUMMARY_SELECT,
  });
}
