import { NextResponse } from "next/server";

type Bucket = {
  count: number;
  resetAt: number;
};

// In-memory, per-process. Fine for this app's single-instance deployment;
// does not coordinate across multiple replicas.
const buckets = new Map<string, Bucket>();

let callsSinceSweep = 0;
const SWEEP_EVERY_N_CALLS = 500;

function sweepExpired(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export const RATE_LIMITS = {
  authLogin: { limit: 10, windowMs: 5 * 60 * 1000 },
  authLoginPerEmail: { limit: 10, windowMs: 15 * 60 * 1000 },
  authRegister: { limit: 5, windowMs: 60 * 60 * 1000 },
  authForgotPassword: { limit: 5, windowMs: 60 * 60 * 1000 },
  authForgotPasswordPerEmail: { limit: 5, windowMs: 60 * 60 * 1000 },
  authResetPassword: { limit: 10, windowMs: 60 * 60 * 1000 },
  authResendVerification: { limit: 5, windowMs: 60 * 60 * 1000 },
  authResendVerificationPerEmail: { limit: 5, windowMs: 60 * 60 * 1000 },
  aiProcessInteraction: { limit: 20, windowMs: 10 * 60 * 1000 },
  apiGeneral: { limit: 120, windowMs: 60 * 1000 },
  accountUpdateProfile: { limit: 10, windowMs: 60 * 60 * 1000 },
  accountChangePassword: { limit: 5, windowMs: 60 * 60 * 1000 },
  mcpToolCall: { limit: 60, windowMs: 60 * 1000 },
  oauthToken: { limit: 30, windowMs: 60 * 1000 },
  adminRead: { limit: 120, windowMs: 60 * 1000 },
  adminWrite: { limit: 30, windowMs: 60 * 1000 },
} as const;

export type RateLimitName = keyof typeof RATE_LIMITS;

export type RateLimitResult = { limited: false } | { limited: true; retryAfterSeconds: number };

/** Fixed-window counter per (bucket name, identifier). */
export function checkRateLimit(name: RateLimitName, identifier: string): RateLimitResult {
  const { limit, windowMs } = RATE_LIMITS[name];
  const now = Date.now();

  callsSinceSweep += 1;
  if (callsSinceSweep >= SWEEP_EVERY_N_CALLS) {
    callsSinceSweep = 0;
    sweepExpired(now);
  }

  const key = `${name}:${identifier}`;
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false };
  }

  if (existing.count < limit) {
    existing.count += 1;
    return { limited: false };
  }

  return { limited: true, retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
}

/** Best-effort client IP from proxy headers (Traefik sets x-forwarded-for). */
export function getClientIp(headersList: { get(name: string): string | null }): string {
  const forwarded = headersList.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return headersList.get("x-real-ip") ?? "unknown";
}

/** Standard 429 JSON response for Route Handlers. */
export function rateLimitedResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Too many requests." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}
