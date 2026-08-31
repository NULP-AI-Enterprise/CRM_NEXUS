import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { ContactCategory, InteractionType } from "@/generated/prisma/enums";
import { sanitizeContact } from "@/lib/mcp/sanitize";
import { contactFieldsShape, updateField } from "@/lib/validation/contact";
import { companyFieldsShape } from "@/lib/validation/company";
import { communityFieldsShape } from "@/lib/validation/community";
import { interactionOwnerConditions } from "@/lib/data/interaction-ownership";
import type { McpAuthContext } from "@/lib/mcp/auth";

function jsonResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }], structuredContent: data as Record<string, unknown> };
}

function errorResult(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

const contactOutputSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  role: z.string().nullable(),
  companyName: z.string().nullable(),
  category: z.nativeEnum(ContactCategory),
  usefulnessScore: z.number().int().nullable(),
  phone: z.string().nullable(),
  linkedin: z.string().nullable(),
  telegram: z.string().nullable(),
  instagram: z.string().nullable(),
  whatsapp: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  temperament: z.string().nullable(),
  needs: z.string().nullable(),
  valuePotential: z.string().nullable(),
  fullSummary: z.string().nullable(),
});

function toContactSummary(contact: {
  id: string;
  fullName: string;
  role: string | null;
  companyName: string | null;
  category: (typeof ContactCategory)[keyof typeof ContactCategory];
  usefulnessScore: number | null;
  phone: string | null;
  linkedin: string | null;
  telegram: string | null;
  instagram: string | null;
  whatsapp: string | null;
  city: string | null;
  country: string | null;
  temperament: string | null;
  needs: string | null;
  valuePotential: string | null;
  fullSummary: string | null;
}) {
  const { id, fullName, role, companyName, category, usefulnessScore, phone, linkedin, telegram, instagram, whatsapp, city, country, temperament, needs, valuePotential, fullSummary } = contact;
  return { id, fullName, role, companyName, category, usefulnessScore, phone, linkedin, telegram, instagram, whatsapp, city, country, temperament, needs, valuePotential, fullSummary };
}

async function resolveValidCommunityIds(userId: string, communityIds: string[] | undefined): Promise<string[]> {
  if (!communityIds || communityIds.length === 0) return [];
  const owned = await prisma.community.findMany({ where: { id: { in: communityIds }, userId }, select: { id: true } });
  return owned.map((c) => c.id);
}

/** For create: no prior state to preserve, so an omitted companyId simply
 * means "no company" — same as an empty one. */
async function resolveCompanyForCreate(userId: string, companyId: string | null | undefined) {
  if (!companyId) return { companyId: null, companyName: null };
  const company = await prisma.company.findFirst({ where: { id: companyId, userId } });
  if (!company) throw new Error("Company not found.");
  return { companyId, companyName: company.name };
}

/** For update: `undefined` means the caller didn't mention companyId at all
 * and the existing link must be left alone — only an explicit value (a real
 * id, or an empty string/null to clear it) may change it. Getting this wrong
 * silently wipes the field on every partial update that omits it. */
async function resolveCompanyForUpdate(userId: string, companyId: string | null | undefined) {
  if (companyId === undefined) return { companyId: undefined, companyName: undefined };
  if (!companyId) return { companyId: null, companyName: null };
  const company = await prisma.company.findFirst({ where: { id: companyId, userId } });
  if (!company) throw new Error("Company not found.");
  return { companyId, companyName: company.name };
}

/** Only registered for READ_WRITE-scope keys. Every tool re-verifies
 * ownership via `findFirst({ id, userId })` before mutating — the same
 * pattern every existing /api/* route already uses. */
export function registerWriteTools(server: McpServer, context: McpAuthContext) {
  const userId = context.userId;
  const redact = context.redactSensitive;

  // ---- contacts ----

  server.registerTool(
    "create_contact",
    {
      title: "Create contact",
      description: "Creates a new contact.",
      inputSchema: contactFieldsShape,
      outputSchema: { contact: contactOutputSchema },
    },
    async (input) => {
      let company;
      try {
        company = await resolveCompanyForCreate(userId, input.companyId);
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : "Failed to resolve company.");
      }
      const validCommunityIds = await resolveValidCommunityIds(userId, input.communityIds);

      const contact = await prisma.contact.create({
        data: {
          userId,
          fullName: input.fullName,
          role: input.role || null,
          companyId: company.companyId,
          companyName: company.companyName,
          category: input.category ?? ContactCategory.OTHER,
          usefulnessScore: input.usefulnessScore ?? null,
          phone: input.phone || null,
          linkedin: input.linkedin || null,
          telegram: input.telegram || null,
          instagram: input.instagram || null,
          whatsapp: input.whatsapp || null,
          city: input.city || null,
          country: input.country || null,
          temperament: input.temperament || null,
          needs: input.needs || null,
          valuePotential: input.valuePotential || null,
          fullSummary: input.fullSummary || null,
          communities: { connect: validCommunityIds.map((id) => ({ id })) },
        },
      });

      return jsonResult({ contact: sanitizeContact(toContactSummary(contact), redact) });
    },
  );

  server.registerTool(
    "update_contact",
    {
      title: "Update contact",
      description:
        "Updates an existing contact. Only fields you include are changed — omitted fields keep their current value (pass null explicitly to clear one).",
      inputSchema: { contactId: z.string(), ...contactFieldsShape },
      outputSchema: { contact: contactOutputSchema },
    },
    async ({ contactId, ...input }) => {
      const existing = await prisma.contact.findFirst({ where: { id: contactId, userId } });
      if (!existing) return errorResult("Contact not found.");

      let company;
      try {
        company = await resolveCompanyForUpdate(userId, input.companyId);
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : "Failed to resolve company.");
      }

      const communitiesUpdate =
        input.communityIds !== undefined
          ? { set: (await resolveValidCommunityIds(userId, input.communityIds)).map((id) => ({ id })) }
          : undefined;

      const contact = await prisma.contact.update({
        where: { id: contactId },
        data: {
          fullName: input.fullName,
          role: updateField(input.role),
          companyId: company.companyId,
          companyName: company.companyName,
          category: input.category,
          usefulnessScore: input.usefulnessScore === undefined ? undefined : input.usefulnessScore,
          phone: updateField(input.phone),
          linkedin: updateField(input.linkedin),
          telegram: updateField(input.telegram),
          instagram: updateField(input.instagram),
          whatsapp: updateField(input.whatsapp),
          city: updateField(input.city),
          country: updateField(input.country),
          temperament: updateField(input.temperament),
          needs: updateField(input.needs),
          valuePotential: updateField(input.valuePotential),
          fullSummary: updateField(input.fullSummary),
          communities: communitiesUpdate,
        },
      });

      return jsonResult({ contact: sanitizeContact(toContactSummary(contact), redact) });
    },
  );

  server.registerTool(
    "delete_contact",
    {
      title: "Delete contact",
      description: "Permanently deletes a contact, including their interactions and connections.",
      inputSchema: { contactId: z.string() },
    },
    async ({ contactId }) => {
      const existing = await prisma.contact.findFirst({ where: { id: contactId, userId } });
      if (!existing) return errorResult("Contact not found.");
      await prisma.contact.delete({ where: { id: contactId } });
      return jsonResult({ success: true });
    },
  );

  // ---- companies ----

  const orgSelect = {
    id: true,
    name: true,
    industry: true,
    description: true,
    linkedin: true,
    phone: true,
    city: true,
    country: true,
    usefulnessScore: true,
    needs: true,
    valuePotential: true,
    fullSummary: true,
  } as const;

  server.registerTool(
    "create_company",
    {
      title: "Create company",
      description: "Creates a new company.",
      inputSchema: companyFieldsShape,
    },
    async ({ name, industry, description, linkedin, phone, city, country, usefulnessScore, needs, valuePotential, fullSummary }) => {
      const existing = await prisma.company.findFirst({ where: { userId, name: { equals: name, mode: "insensitive" } } });
      if (existing) return errorResult("A company with this name already exists.");

      const company = await prisma.company.create({
        data: {
          userId,
          name,
          industry: industry || null,
          description: description || null,
          linkedin: linkedin || null,
          phone: phone || null,
          city: city || null,
          country: country || null,
          usefulnessScore: usefulnessScore ?? null,
          needs: needs || null,
          valuePotential: valuePotential || null,
          fullSummary: fullSummary || null,
        },
        select: orgSelect,
      });
      return jsonResult({ company });
    },
  );

  server.registerTool(
    "update_company",
    {
      title: "Update company",
      description:
        "Updates an existing company. Only fields you include are changed — omitted fields keep their current value. Renaming also updates the cached company name on its contacts.",
      inputSchema: { companyId: z.string(), ...companyFieldsShape },
    },
    async ({ companyId, name, industry, description, linkedin, phone, city, country, usefulnessScore, needs, valuePotential, fullSummary }) => {
      const existing = await prisma.company.findFirst({ where: { id: companyId, userId } });
      if (!existing) return errorResult("Company not found.");

      const duplicate = await prisma.company.findFirst({
        where: { userId, id: { not: companyId }, name: { equals: name, mode: "insensitive" } },
      });
      if (duplicate) return errorResult("A company with this name already exists.");

      const company = await prisma.company.update({
        where: { id: companyId },
        data: {
          name,
          industry: updateField(industry),
          description: updateField(description),
          linkedin: updateField(linkedin),
          phone: updateField(phone),
          city: updateField(city),
          country: updateField(country),
          usefulnessScore: updateField(usefulnessScore),
          needs: updateField(needs),
          valuePotential: updateField(valuePotential),
          fullSummary: updateField(fullSummary),
        },
        select: orgSelect,
      });
      await prisma.contact.updateMany({ where: { companyId }, data: { companyName: company.name } });

      return jsonResult({ company });
    },
  );

  server.registerTool(
    "delete_company",
    {
      title: "Delete company",
      description: "Deletes a company. Contacts who worked there are not deleted, just unlinked.",
      inputSchema: { companyId: z.string() },
    },
    async ({ companyId }) => {
      const existing = await prisma.company.findFirst({ where: { id: companyId, userId } });
      if (!existing) return errorResult("Company not found.");
      await prisma.company.delete({ where: { id: companyId } });
      return jsonResult({ success: true });
    },
  );

  // ---- communities ----

  const communitySelect = {
    id: true,
    name: true,
    description: true,
    linkedin: true,
    phone: true,
    city: true,
    country: true,
    usefulnessScore: true,
    needs: true,
    valuePotential: true,
    fullSummary: true,
  } as const;

  server.registerTool(
    "create_community",
    {
      title: "Create community",
      description: "Creates a new community (meetup, alumni network, etc.).",
      inputSchema: communityFieldsShape,
    },
    async ({ name, description, linkedin, phone, city, country, usefulnessScore, needs, valuePotential, fullSummary }) => {
      const existing = await prisma.community.findFirst({ where: { userId, name: { equals: name, mode: "insensitive" } } });
      if (existing) return errorResult("A community with this name already exists.");

      const community = await prisma.community.create({
        data: {
          userId,
          name,
          description: description || null,
          linkedin: linkedin || null,
          phone: phone || null,
          city: city || null,
          country: country || null,
          usefulnessScore: usefulnessScore ?? null,
          needs: needs || null,
          valuePotential: valuePotential || null,
          fullSummary: fullSummary || null,
        },
        select: communitySelect,
      });
      return jsonResult({ community });
    },
  );

  server.registerTool(
    "update_community",
    {
      title: "Update community",
      description:
        "Updates an existing community. Only fields you include are changed — omitted fields keep their current value.",
      inputSchema: { communityId: z.string(), ...communityFieldsShape },
    },
    async ({ communityId, name, description, linkedin, phone, city, country, usefulnessScore, needs, valuePotential, fullSummary }) => {
      const existing = await prisma.community.findFirst({ where: { id: communityId, userId } });
      if (!existing) return errorResult("Community not found.");

      const duplicate = await prisma.community.findFirst({
        where: { userId, id: { not: communityId }, name: { equals: name, mode: "insensitive" } },
      });
      if (duplicate) return errorResult("A community with this name already exists.");

      const community = await prisma.community.update({
        where: { id: communityId },
        data: {
          name,
          description: updateField(description),
          linkedin: updateField(linkedin),
          phone: updateField(phone),
          city: updateField(city),
          country: updateField(country),
          usefulnessScore: updateField(usefulnessScore),
          needs: updateField(needs),
          valuePotential: updateField(valuePotential),
          fullSummary: updateField(fullSummary),
        },
        select: communitySelect,
      });
      return jsonResult({ community });
    },
  );

  server.registerTool(
    "delete_community",
    {
      title: "Delete community",
      description: "Deletes a community. Members are not deleted, just unlinked from it.",
      inputSchema: { communityId: z.string() },
    },
    async ({ communityId }) => {
      const existing = await prisma.community.findFirst({ where: { id: communityId, userId } });
      if (!existing) return errorResult("Community not found.");
      await prisma.community.delete({ where: { id: communityId } });
      return jsonResult({ success: true });
    },
  );

  // ---- connections ----

  server.registerTool(
    "create_connection",
    {
      title: "Create connection",
      description:
        "Links two of the user's own contacts as a relationship (e.g. colleagues, introduced-by). Calling again for the same pair updates it instead of duplicating.",
      inputSchema: {
        fromContactId: z.string(),
        toContactId: z.string(),
        relationship: z.string().trim().max(200).optional(),
        strength: z.number().int().min(1).max(5).optional().describe("1 (weak) to 5 (strong). Defaults to 1."),
        notes: z.string().trim().max(2000).optional(),
      },
    },
    async ({ fromContactId, toContactId, relationship, strength, notes }) => {
      if (fromContactId === toContactId) return errorResult("Cannot connect a contact to themselves.");

      const [fromContact, toContact] = await Promise.all([
        prisma.contact.findFirst({ where: { id: fromContactId, userId } }),
        prisma.contact.findFirst({ where: { id: toContactId, userId } }),
      ]);
      if (!fromContact || !toContact) return errorResult("Contact not found.");

      const connection = await prisma.contactConnection.upsert({
        where: { fromContactId_toContactId: { fromContactId, toContactId } },
        update: { relationship: relationship ?? undefined, strength: strength ?? undefined, notes: notes ?? undefined },
        create: {
          userId,
          fromContactId,
          toContactId,
          relationship: relationship ?? "Зв'язок",
          strength: strength ?? 1,
          notes: notes ?? null,
        },
        select: { id: true, fromContactId: true, toContactId: true, relationship: true, strength: true, notes: true },
      });

      return jsonResult({ connection });
    },
  );

  server.registerTool(
    "delete_connection",
    {
      title: "Delete connection",
      description: "Removes a connection between two contacts.",
      inputSchema: { connectionId: z.string().describe("From get_contact's connections list.") },
    },
    async ({ connectionId }) => {
      const result = await prisma.contactConnection.deleteMany({ where: { id: connectionId, userId } });
      if (result.count === 0) return errorResult("Connection not found.");
      return jsonResult({ success: true });
    },
  );

  server.registerTool(
    "log_connection_interaction",
    {
      title: "Log connection interaction",
      description:
        "Logs a dated event on a connection between two of the user's own contacts (e.g. 'Andriy and the academy owner spoke on Tuesday') — distinct from process_interaction, which is for the user's own conversations.",
      inputSchema: {
        connectionId: z.string(),
        rawText: z.string().trim().min(1).max(8000),
        followUp: z.string().trim().max(2000).nullish(),
        followUpDate: z.string().date().nullish().describe("YYYY-MM-DD"),
        parentInteractionId: z
          .string()
          .optional()
          .describe(
            "Branch this off an existing interaction of the user's — any of their contacts or connections, not necessarily this one (e.g. X introduced Y: Y's first interaction can branch off X's) — instead of the main line.",
          ),
      },
    },
    async ({ connectionId, rawText, followUp, followUpDate, parentInteractionId }) => {
      const connection = await prisma.contactConnection.findFirst({ where: { id: connectionId, userId } });
      if (!connection) return errorResult("Connection not found.");

      const validParentId = parentInteractionId
        ? (await prisma.interaction.findFirst({ where: { id: parentInteractionId, OR: interactionOwnerConditions(userId) }, select: { id: true } }))?.id ?? null
        : null;

      const interaction = await prisma.interaction.create({
        data: {
          connectionId: connection.id,
          type: "MEMO",
          rawText,
          followUp: followUp || null,
          followUpDate: followUpDate ? new Date(followUpDate) : null,
          parentInteractionId: validParentId,
        },
      });

      return jsonResult({
        interaction: {
          id: interaction.id,
          rawText: redact ? "[redacted]" : interaction.rawText,
          followUp: interaction.followUp,
          followUpDate: interaction.followUpDate?.toISOString() ?? null,
          createdAt: interaction.createdAt.toISOString(),
          parentInteractionId: interaction.parentInteractionId,
        },
      });
    },
  );

  server.registerTool(
    "log_contact_interaction",
    {
      title: "Log contact interaction",
      description:
        "Logs a structured interaction on one of the user's own contacts without running the AI extraction pipeline (unlike process_interaction, this never creates a contact, updates their profile, or calls OpenAI).",
      inputSchema: {
        contactId: z.string(),
        rawText: z.string().trim().min(1).max(8000),
        type: z.nativeEnum(InteractionType).optional().describe("Defaults to NOTE."),
        followUp: z.string().trim().max(2000).nullish(),
        followUpDate: z.string().date().nullish().describe("YYYY-MM-DD"),
        parentInteractionId: z
          .string()
          .optional()
          .describe(
            "Branch this off an existing interaction of the user's — any of their contacts or connections, not necessarily this one (e.g. X introduced Y: Y's first interaction can branch off X's) — instead of the main line.",
          ),
      },
    },
    async ({ contactId, rawText, type, followUp, followUpDate, parentInteractionId }) => {
      const contact = await prisma.contact.findFirst({ where: { id: contactId, userId } });
      if (!contact) return errorResult("Contact not found.");

      const validParentId = parentInteractionId
        ? (await prisma.interaction.findFirst({ where: { id: parentInteractionId, OR: interactionOwnerConditions(userId) }, select: { id: true } }))?.id ?? null
        : null;

      const interaction = await prisma.interaction.create({
        data: {
          contactId: contact.id,
          type: type ?? "MEMO",
          rawText,
          followUp: followUp || null,
          followUpDate: followUpDate ? new Date(followUpDate) : null,
          parentInteractionId: validParentId,
        },
      });

      return jsonResult({
        interaction: {
          id: interaction.id,
          type: interaction.type,
          rawText: redact ? "[redacted]" : interaction.rawText,
          followUp: interaction.followUp,
          followUpDate: interaction.followUpDate?.toISOString() ?? null,
          createdAt: interaction.createdAt.toISOString(),
          parentInteractionId: interaction.parentInteractionId,
        },
      });
    },
  );

  server.registerTool(
    "log_company_interaction",
    {
      title: "Log company interaction",
      description:
        "Logs a structured interaction against one of the user's own companies (not any one person there) without running the AI extraction pipeline.",
      inputSchema: {
        companyId: z.string(),
        rawText: z.string().trim().min(1).max(8000),
        type: z.nativeEnum(InteractionType).optional().describe("Defaults to MEMO."),
        followUp: z.string().trim().max(2000).nullish(),
        followUpDate: z.string().date().nullish().describe("YYYY-MM-DD"),
        parentInteractionId: z
          .string()
          .optional()
          .describe("Branch this off an existing interaction of the user's — any of their contacts, connections, companies or communities — instead of the main line."),
      },
    },
    async ({ companyId, rawText, type, followUp, followUpDate, parentInteractionId }) => {
      const company = await prisma.company.findFirst({ where: { id: companyId, userId } });
      if (!company) return errorResult("Company not found.");

      const validParentId = parentInteractionId
        ? (await prisma.interaction.findFirst({ where: { id: parentInteractionId, OR: interactionOwnerConditions(userId) }, select: { id: true } }))?.id ?? null
        : null;

      const interaction = await prisma.interaction.create({
        data: {
          companyId: company.id,
          type: type ?? "MEMO",
          rawText,
          followUp: followUp || null,
          followUpDate: followUpDate ? new Date(followUpDate) : null,
          parentInteractionId: validParentId,
        },
      });

      return jsonResult({
        interaction: {
          id: interaction.id,
          type: interaction.type,
          rawText: redact ? "[redacted]" : interaction.rawText,
          followUp: interaction.followUp,
          followUpDate: interaction.followUpDate?.toISOString() ?? null,
          createdAt: interaction.createdAt.toISOString(),
          parentInteractionId: interaction.parentInteractionId,
        },
      });
    },
  );

  server.registerTool(
    "log_community_interaction",
    {
      title: "Log community interaction",
      description:
        "Logs a structured interaction against one of the user's own communities (not any one member) without running the AI extraction pipeline.",
      inputSchema: {
        communityId: z.string(),
        rawText: z.string().trim().min(1).max(8000),
        type: z.nativeEnum(InteractionType).optional().describe("Defaults to MEMO."),
        followUp: z.string().trim().max(2000).nullish(),
        followUpDate: z.string().date().nullish().describe("YYYY-MM-DD"),
        parentInteractionId: z
          .string()
          .optional()
          .describe("Branch this off an existing interaction of the user's — any of their contacts, connections, companies or communities — instead of the main line."),
      },
    },
    async ({ communityId, rawText, type, followUp, followUpDate, parentInteractionId }) => {
      const community = await prisma.community.findFirst({ where: { id: communityId, userId } });
      if (!community) return errorResult("Community not found.");

      const validParentId = parentInteractionId
        ? (await prisma.interaction.findFirst({ where: { id: parentInteractionId, OR: interactionOwnerConditions(userId) }, select: { id: true } }))?.id ?? null
        : null;

      const interaction = await prisma.interaction.create({
        data: {
          communityId: community.id,
          type: type ?? "MEMO",
          rawText,
          followUp: followUp || null,
          followUpDate: followUpDate ? new Date(followUpDate) : null,
          parentInteractionId: validParentId,
        },
      });

      return jsonResult({
        interaction: {
          id: interaction.id,
          type: interaction.type,
          rawText: redact ? "[redacted]" : interaction.rawText,
          followUp: interaction.followUp,
          followUpDate: interaction.followUpDate?.toISOString() ?? null,
          createdAt: interaction.createdAt.toISOString(),
          parentInteractionId: interaction.parentInteractionId,
        },
      });
    },
  );

  server.registerTool(
    "update_interaction",
    {
      title: "Update interaction",
      description:
        "Updates the text, follow-up, or branch parent of an existing interaction (on either a contact or a connection). Only fields you include are changed.",
      inputSchema: {
        interactionId: z.string(),
        rawText: z.string().trim().min(1).max(8000).optional(),
        followUp: z.string().trim().max(2000).nullish(),
        followUpDate: z.string().date().nullish().describe("YYYY-MM-DD"),
        parentInteractionId: z
          .string()
          .nullish()
          .describe(
            "Re-point which event this one branches from — any of the user's own interactions, or null to move it back onto the main line. Rejected if it would make the branch chain loop.",
          ),
      },
    },
    async ({ interactionId, rawText, followUp, followUpDate, parentInteractionId }) => {
      const existing = await prisma.interaction.findFirst({
        where: { id: interactionId, OR: interactionOwnerConditions(userId) },
      });
      if (!existing) return errorResult("Interaction not found.");

      if (parentInteractionId) {
        const parent = await prisma.interaction.findFirst({
          where: { id: parentInteractionId, OR: interactionOwnerConditions(userId) },
          select: { id: true },
        });
        if (!parent) return errorResult("Parent interaction not found.");

        // Same loop guard as the HTTP route: re-parenting is the only way to
        // close a cycle, and a cycle would hang every reader that walks the chain.
        if (interactionId === parentInteractionId) return errorResult("An interaction cannot branch from itself.");
        const seen = new Set<string>([parentInteractionId]);
        let cursor: string | null = parentInteractionId;
        while (cursor) {
          const node: { parentInteractionId: string | null } | null = await prisma.interaction.findFirst({
            where: { id: cursor, OR: interactionOwnerConditions(userId) },
            select: { parentInteractionId: true },
          });
          const next: string | null = node?.parentInteractionId ?? null;
          if (!next) break;
          if (next === interactionId) return errorResult("That would make the branch loop back on itself.");
          if (seen.has(next)) break;
          seen.add(next);
          cursor = next;
        }
      }

      const interaction = await prisma.interaction.update({
        where: { id: interactionId },
        data: {
          rawText,
          followUp: followUp === undefined ? undefined : followUp,
          followUpDate: followUpDate === undefined ? undefined : followUpDate ? new Date(followUpDate) : null,
          parentInteractionId: parentInteractionId === undefined ? undefined : parentInteractionId,
        },
      });

      return jsonResult({
        interaction: {
          id: interaction.id,
          rawText: redact ? "[redacted]" : interaction.rawText,
          followUp: interaction.followUp,
          followUpDate: interaction.followUpDate?.toISOString() ?? null,
          parentInteractionId: interaction.parentInteractionId,
        },
      });
    },
  );

  server.registerTool(
    "delete_interaction",
    {
      title: "Delete interaction",
      description: "Permanently deletes an interaction. Any branches off it are deleted too.",
      inputSchema: { interactionId: z.string() },
    },
    async ({ interactionId }) => {
      const existing = await prisma.interaction.findFirst({
        where: { id: interactionId, OR: interactionOwnerConditions(userId) },
      });
      if (!existing) return errorResult("Interaction not found.");

      await prisma.interaction.delete({ where: { id: interactionId } });
      return jsonResult({ success: true });
    },
  );
}
