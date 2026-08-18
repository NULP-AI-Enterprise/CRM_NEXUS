import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerReadTools } from "@/lib/mcp/tools/read";
import { registerProcessInteractionTool } from "@/lib/mcp/tools/process-interaction";
import { registerWriteTools } from "@/lib/mcp/tools/write";
import type { McpAuthContext } from "@/lib/mcp/auth";

/** Builds a fresh MCP server per request, with every tool closing over this
 * request's already-authenticated `userId` — no tool ever accepts `userId`
 * as a client-suppliable argument. Write tools are only registered at all
 * for a READ_WRITE-scope key, so a READ key's tool list never even shows
 * them (not just a runtime check on use). */
export function buildMcpServer(context: McpAuthContext): McpServer {
  const server = new McpServer({ name: "nexus-crm", version: "1.0.0" });

  registerReadTools(server, context);

  if (context.scope === "READ_WRITE") {
    registerProcessInteractionTool(server, context);
    registerWriteTools(server, context);
  }

  return server;
}
