import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { resolveApiKeyContext } from "@/lib/mcp/auth";
import { buildMcpServer } from "@/lib/mcp/server";
import { checkRateLimit } from "@/lib/rate-limit";

async function handleMcpRequest(request: Request): Promise<Response> {
  const authContext = await resolveApiKeyContext(request);
  if (!authContext) {
    const origin = process.env.APP_URL || "http://localhost:3000";
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized" }, id: null },
      {
        status: 401,
        // Points an OAuth-capable client (e.g. Claude's web connector) at
        // the protected-resource metadata so it can discover /oauth/authorize
        // and /api/oauth/token — the standard RFC 9728 discovery trigger.
        headers: { "WWW-Authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"` },
      },
    );
  }

  // Keyed by apiKeyId, not IP — a legitimate client calls from a vendor-owned
  // IP range, and a leaked key reused from a new IP must still be throttled.
  const rl = checkRateLimit("mcpToolCall", authContext.apiKeyId);
  if (rl.limited) {
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32000, message: "Rate limited" }, id: null },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  // Stateless: a fresh server+transport pair per request, with tools closing
  // over this request's already-resolved userId/scope/redactSensitive. No
  // session needs to persist between calls since every call re-authenticates.
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = buildMcpServer(authContext);
  await server.connect(transport);
  return transport.handleRequest(request);
}

export async function POST(request: Request) {
  return handleMcpRequest(request);
}

export async function GET(request: Request) {
  return handleMcpRequest(request);
}

export async function DELETE(request: Request) {
  return handleMcpRequest(request);
}
