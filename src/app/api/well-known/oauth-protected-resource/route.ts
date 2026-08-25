import { NextResponse } from "next/server";

/** OAuth 2.0 Protected Resource Metadata (RFC 9728), served at
 * /.well-known/oauth-protected-resource via the next.config.ts rewrite —
 * the discovery entry point a client reaches for from the 401
 * WWW-Authenticate header on /api/mcp, pointing it at this authorization
 * server. */
export async function GET() {
  const origin = process.env.APP_URL || "http://localhost:3000";

  return NextResponse.json({
    resource: `${origin}/api/mcp`,
    authorization_servers: [origin],
  });
}
