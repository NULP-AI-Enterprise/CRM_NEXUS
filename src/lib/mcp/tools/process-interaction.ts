import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { InteractionType } from "@/generated/prisma/enums";
import { ContactNotFoundError, processInteraction } from "@/lib/services/process-interaction";
import { checkRateLimit } from "@/lib/rate-limit";
import type { McpAuthContext } from "@/lib/mcp/auth";

/** Only registered for READ_WRITE-scope keys — this tool creates/updates a
 * contact and logs an interaction, so it's a write operation despite taking
 * freeform text rather than structured fields. */
export function registerProcessInteractionTool(server: McpServer, context: McpAuthContext) {
  server.registerTool(
    "process_interaction",
    {
      title: "Process interaction note",
      description:
        "Runs a freeform note through the same AI extraction pipeline the app's Quick Add uses: identifies or creates the contact, updates their profile, and logs the interaction. Note: this sends the text to OpenAI server-side, in addition to whichever model is driving this tool call.",
      inputSchema: {
        rawText: z.string().trim().min(1).max(8000).describe("The freeform note to process."),
        type: z.nativeEnum(InteractionType).optional().describe("Defaults to NOTE."),
        contactId: z
          .string()
          .optional()
          .describe("Attach to this existing contact instead of auto-matching by name."),
        parentInteractionId: z
          .string()
          .optional()
          .describe(
            "Branch this off an existing interaction of the user's (from get_contact's interactions, or get_cluster_diagram) instead of adding it to the main line — not necessarily on this same contact: e.g. X introduced Y, so Y's first interaction can branch off X's.",
          ),
      },
    },
    async ({ rawText, type, contactId, parentInteractionId }) => {
      // Reuses the same bucket the web UI's Quick Add hits, keyed by API key
      // instead of IP — this calls OpenAI server-side, so it's cost-bearing.
      const rl = checkRateLimit("aiProcessInteraction", context.apiKeyId);
      if (rl.limited) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Rate limited. Try again in ${rl.retryAfterSeconds}s.` }],
        };
      }

      try {
        const contact = await processInteraction({
          userId: context.userId,
          rawText,
          type: type ?? "MEMO",
          contactId,
          parentInteractionId,
        });
        return {
          content: [
            {
              type: "text" as const,
              text: `Logged. Contact: ${contact.fullName} (${contact.id}). Category: ${contact.category}. Usefulness: ${contact.usefulnessScore ?? "n/a"}/10.`,
            },
          ],
        };
      } catch (error) {
        if (error instanceof ContactNotFoundError) {
          return { isError: true, content: [{ type: "text" as const, text: "Contact not found." }] };
        }
        console.error("MCP process_interaction failed:", error);
        return { isError: true, content: [{ type: "text" as const, text: "Failed to process the note." }] };
      }
    },
  );
}
