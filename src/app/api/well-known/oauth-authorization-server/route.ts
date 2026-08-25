import { NextResponse } from "next/server";

/** OAuth 2.0 Authorization Server Metadata (RFC 8414), served at
 * /.well-known/oauth-authorization-server via the next.config.ts rewrite —
 * lets Claude's MCP client discover the /oauth/authorize and
 * /api/oauth/token URLs without them being hardcoded on its side. */
export async function GET() {
  const origin = process.env.APP_URL || "http://localhost:3000";

  return NextResponse.json({
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
  });
}
