import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { getCompaniesWithContacts } from "@/lib/data/companies";
import { listContacts, getContactDetail } from "@/lib/data/contacts";
import { getCommunitiesWithContacts } from "@/lib/data/communities";
import { getGraphData } from "@/lib/data/graph";
import { getTimelineData } from "@/lib/data/timeline";
import { getClusterDiagramData } from "@/lib/data/cluster";
import { entityLabel, getUpcomingFollowUps } from "@/lib/timeline-entity";
import { ContactCategory, InteractionType } from "@/generated/prisma/enums";
import { sanitizeContact, sanitizeRawText } from "@/lib/mcp/sanitize";
import type { McpAuthContext } from "@/lib/mcp/auth";

const companySummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  industry: z.string().nullable(),
  description: z.string().nullable(),
  contactCount: z.number().int(),
});

const contactSummarySchema = z.object({
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

const interactionSummarySchema = z.object({
  id: z.string(),
  type: z.nativeEnum(InteractionType),
  rawText: z.string(),
  followUp: z.string().nullable(),
  followUpDate: z.string().nullable(),
  createdAt: z.string(),
});

const connectionSummarySchema = z.object({
  connectionId: z.string(),
  direction: z.enum(["outgoing", "incoming"]),
  relationship: z.string().nullable(),
  strength: z.number().int(),
  notes: z.string().nullable(),
  otherContact: z.object({
    id: z.string(),
    fullName: z.string(),
    role: z.string().nullable(),
    category: z.nativeEnum(ContactCategory),
  }),
});

const communitySummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  contacts: z.array(
    z.object({ id: z.string(), fullName: z.string(), category: z.nativeEnum(ContactCategory) }),
  ),
});

const timelineEventSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(InteractionType),
  rawText: z.string(),
  followUp: z.string().nullable(),
  followUpDate: z.string().nullable(),
  createdAt: z.string(),
  entityLabel: z.string(),
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
  return {
    id: contact.id,
    fullName: contact.fullName,
    role: contact.role,
    companyName: contact.companyName,
    category: contact.category,
    usefulnessScore: contact.usefulnessScore,
    phone: contact.phone,
    linkedin: contact.linkedin,
    telegram: contact.telegram,
    instagram: contact.instagram,
    whatsapp: contact.whatsapp,
    city: contact.city,
    country: contact.country,
    temperament: contact.temperament,
    needs: contact.needs,
    valuePotential: contact.valuePotential,
    fullSummary: contact.fullSummary,
  };
}

function jsonResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }], structuredContent: data as Record<string, unknown> };
}

function notFoundResult(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

export function registerReadTools(server: McpServer, context: McpAuthContext) {
  const redact = context.redactSensitive;

  server.registerTool(
    "list_companies",
    {
      title: "List companies",
      description: "Lists all companies in the user's network, with a contact count for each.",
      outputSchema: { companies: z.array(companySummarySchema) },
    },
    async () => {
      const { companies } = await getCompaniesWithContacts(context.userId);
      const summaries = companies.map((c) => ({
        id: c.id,
        name: c.name,
        industry: c.industry,
        description: c.description,
        contactCount: c.contacts.length,
      }));
      return jsonResult({ companies: summaries });
    },
  );

  server.registerTool(
    "get_company",
    {
      title: "Get company",
      description: "Gets one company's details plus the contacts who work there.",
      inputSchema: { companyId: z.string().describe("The company's id, from list_companies.") },
      outputSchema: {
        company: companySummarySchema.extend({
          contacts: z.array(z.object({ id: z.string(), fullName: z.string(), role: z.string().nullable() })),
        }),
      },
    },
    async ({ companyId }) => {
      const { companies } = await getCompaniesWithContacts(context.userId);
      const company = companies.find((c) => c.id === companyId);
      if (!company) return notFoundResult("Company not found.");
      return jsonResult({
        company: {
          id: company.id,
          name: company.name,
          industry: company.industry,
          description: company.description,
          contactCount: company.contacts.length,
          contacts: company.contacts.map((c) => ({ id: c.id, fullName: c.fullName, role: c.role })),
        },
      });
    },
  );

  server.registerTool(
    "list_contacts",
    {
      title: "List contacts",
      description: "Lists contacts in the user's network, optionally filtered by category, company, or a name search.",
      inputSchema: {
        category: z.nativeEnum(ContactCategory).optional().describe("Filter to one category."),
        companyId: z.string().optional().describe("Filter to contacts at one company."),
        search: z.string().optional().describe("Case-insensitive substring match on full name."),
      },
      outputSchema: { contacts: z.array(contactSummarySchema) },
    },
    async ({ category, companyId, search }) => {
      const all = await listContacts(context.userId);
      const filtered = all.filter(
        (c) =>
          (!category || c.category === category) &&
          (!companyId || c.companyId === companyId) &&
          (!search || c.fullName.toLowerCase().includes(search.toLowerCase())),
      );
      const summaries = filtered.map((c) => sanitizeContact(toContactSummary(c), redact));
      return jsonResult({ contacts: summaries });
    },
  );

  server.registerTool(
    "get_contact",
    {
      title: "Get contact",
      description: "Gets one contact's full profile: company, communities, connections, and interaction history.",
      inputSchema: { contactId: z.string().describe("The contact's id, from list_contacts.") },
      outputSchema: {
        contact: contactSummarySchema,
        communities: z.array(z.object({ id: z.string(), name: z.string() })),
        connections: z.array(connectionSummarySchema),
        interactions: z.array(interactionSummarySchema),
      },
    },
    async ({ contactId }) => {
      const detail = await getContactDetail(context.userId, contactId);
      if (!detail) return notFoundResult("Contact not found.");

      const connections = [
        ...detail.outgoingConnections.map((c) => ({
          connectionId: c.id,
          direction: "outgoing" as const,
          relationship: c.relationship,
          strength: c.strength,
          notes: c.notes,
          otherContact: {
            id: c.toContact.id,
            fullName: c.toContact.fullName,
            role: c.toContact.role,
            category: c.toContact.category,
          },
        })),
        ...detail.incomingConnections.map((c) => ({
          connectionId: c.id,
          direction: "incoming" as const,
          relationship: c.relationship,
          strength: c.strength,
          notes: c.notes,
          otherContact: {
            id: c.fromContact.id,
            fullName: c.fromContact.fullName,
            role: c.fromContact.role,
            category: c.fromContact.category,
          },
        })),
      ];

      const interactions = detail.interactions.map((i) =>
        sanitizeRawText(
          {
            id: i.id,
            type: i.type,
            rawText: i.rawText,
            followUp: i.followUp,
            followUpDate: i.followUpDate?.toISOString() ?? null,
            createdAt: i.createdAt.toISOString(),
          },
          redact,
        ),
      );

      return jsonResult({
        contact: sanitizeContact(toContactSummary(detail), redact),
        communities: detail.communities.map((c) => ({ id: c.id, name: c.name })),
        connections,
        interactions,
      });
    },
  );

  server.registerTool(
    "list_communities",
    {
      title: "List communities",
      description: "Lists all communities (meetups, alumni networks, etc.) and their members.",
      outputSchema: { communities: z.array(communitySummarySchema) },
    },
    async () => {
      const communities = await getCommunitiesWithContacts(context.userId);
      const summaries = communities.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        contacts: c.contacts.map((m) => ({ id: m.id, fullName: m.fullName, category: m.category })),
      }));
      return jsonResult({ communities: summaries });
    },
  );

  server.registerTool(
    "get_community",
    {
      title: "Get community",
      description: "Gets one community's details and member list.",
      inputSchema: { communityId: z.string().describe("The community's id, from list_communities.") },
      outputSchema: { community: communitySummarySchema },
    },
    async ({ communityId }) => {
      const communities = await getCommunitiesWithContacts(context.userId);
      const community = communities.find((c) => c.id === communityId);
      if (!community) return notFoundResult("Community not found.");
      return jsonResult({
        community: {
          id: community.id,
          name: community.name,
          description: community.description,
          contacts: community.contacts.map((m) => ({ id: m.id, fullName: m.fullName, category: m.category })),
        },
      });
    },
  );

  server.registerTool(
    "get_network_summary",
    {
      title: "Get network summary",
      description: "High-level stats about the user's network: totals, average score, category breakdown, and the most-connected contacts.",
      outputSchema: {
        totalContacts: z.number().int(),
        totalCompanies: z.number().int(),
        totalConnections: z.number().int(),
        avgScore: z.number(),
        topHubs: z.array(z.object({ id: z.string(), name: z.string(), degree: z.number().int(), category: z.nativeEnum(ContactCategory) })),
        categoryCounts: z.record(z.nativeEnum(ContactCategory), z.number().int()),
      },
    },
    async () => {
      const { stats } = await getGraphData(context.userId);
      return jsonResult(stats);
    },
  );

  server.registerTool(
    "get_timeline",
    {
      title: "Get timeline",
      description:
        "Gets the chronological event history across the user's network — both direct interactions with a contact and logged events between two of the user's own contacts.",
      inputSchema: {
        range: z
          .enum(["week", "month", "all"])
          .optional()
          .describe("How far back to include. Defaults to 'month'."),
      },
      outputSchema: { events: z.array(timelineEventSchema) },
    },
    async ({ range }) => {
      const events = await getTimelineData(context.userId);

      const cutoffMs =
        range === "week" ? 7 * 24 * 60 * 60 * 1000 : range === "all" ? Infinity : 30 * 24 * 60 * 60 * 1000;
      const now = Date.now();

      const filtered = events.filter((e) => {
        const isFuture = e.followUpDate ? new Date(e.followUpDate).getTime() > now : false;
        return isFuture || now - new Date(e.createdAt).getTime() <= cutoffMs;
      });

      const withLabels = filtered.map((e) =>
        sanitizeRawText(
          {
            id: e.id,
            type: e.type,
            rawText: e.rawText,
            followUp: e.followUp,
            followUpDate: e.followUpDate,
            createdAt: e.createdAt,
            entityLabel: entityLabel(e.entity),
          },
          redact,
        ),
      );

      return jsonResult({ events: withLabels });
    },
  );

  server.registerTool(
    "list_upcoming_follow_ups",
    {
      title: "List upcoming follow-ups",
      description: "Lists logged events that have a future follow-up date — what the user is waiting on or needs to act on next.",
      inputSchema: { limit: z.number().int().min(1).max(100).optional().describe("Max results. Defaults to 20.") },
      outputSchema: { followUps: z.array(timelineEventSchema) },
    },
    async ({ limit }) => {
      const events = await getTimelineData(context.userId);

      const upcoming = getUpcomingFollowUps(events)
        .slice(0, limit ?? 20)
        .map((e) =>
          sanitizeRawText(
            {
              id: e.id,
              type: e.type,
              rawText: e.rawText,
              followUp: e.followUp,
              followUpDate: e.followUpDate,
              createdAt: e.createdAt,
              entityLabel: entityLabel(e.entity),
            },
            redact,
          ),
        );

      return jsonResult({ followUps: upcoming });
    },
  );

  server.registerTool(
    "get_cluster_diagram",
    {
      title: "Get cluster diagram",
      description:
        "Gets the full connected-component ('cluster') containing a contact or connection: every member, the connections between them, and every event — including branch structure (each event's parentInteractionId, if it's a branch off another). Mirrors what the app's workflow diagram shows.",
      inputSchema: {
        entityKey: z
          .string()
          .describe("'contact:<id>' or 'connection:<id>', from list_contacts/get_contact or a connection's id."),
      },
      outputSchema: {
        members: z.array(z.object({ id: z.string(), fullName: z.string(), category: z.nativeEnum(ContactCategory) })),
        edges: z.array(z.object({ id: z.string(), fromContactId: z.string(), toContactId: z.string(), relationship: z.string().nullable() })),
        events: z.array(
          z.object({
            id: z.string(),
            type: z.nativeEnum(InteractionType),
            rawText: z.string(),
            followUp: z.string().nullable(),
            followUpDate: z.string().nullable(),
            createdAt: z.string(),
            parentInteractionId: z.string().nullable(),
            entityLabel: z.string(),
          }),
        ),
      },
    },
    async ({ entityKey }) => {
      const cluster = await getClusterDiagramData(context.userId, entityKey);
      if (!cluster) return notFoundResult("Entity not found.");

      return jsonResult({
        members: cluster.members,
        edges: cluster.edges,
        events: cluster.events.map((e) =>
          sanitizeRawText(
            {
              id: e.id,
              type: e.type,
              rawText: e.rawText,
              followUp: e.followUp,
              followUpDate: e.followUpDate,
              createdAt: e.createdAt,
              parentInteractionId: e.parentInteractionId,
              entityLabel: entityLabel(e.entity),
            },
            redact,
          ),
        ),
      });
    },
  );
}
