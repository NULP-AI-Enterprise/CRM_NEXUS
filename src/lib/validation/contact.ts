import { z } from "zod";
import { ContactCategory } from "@/generated/prisma/enums";

/** Shared across /api/contacts, the admin panel, and the MCP write tools —
 *  a raw shape (not z.object(...)) because MCP's registerTool expects a Zod
 *  raw shape for inputSchema; Route Handlers wrap it below. */
export const contactFieldsShape = {
  fullName: z.string().trim().min(1).max(200),
  role: z.string().trim().max(200).nullish(),
  companyId: z.string().min(1).nullish(),
  category: z.nativeEnum(ContactCategory).optional(),
  usefulnessScore: z.number().int().min(1).max(10).nullish(),
  phone: z.string().trim().max(50).nullish(),
  linkedin: z.string().trim().max(300).nullish(),
  telegram: z.string().trim().max(100).nullish(),
  instagram: z.string().trim().max(100).nullish(),
  whatsapp: z.string().trim().max(50).nullish(),
  city: z.string().trim().max(150).nullish(),
  country: z.string().trim().max(150).nullish(),
  temperament: z.string().trim().max(2000).nullish(),
  needs: z.string().trim().max(2000).nullish(),
  valuePotential: z.string().trim().max(2000).nullish(),
  fullSummary: z.string().trim().max(5000).nullish(),
  communityIds: z.array(z.string().min(1)).optional(),
};

export const contactInputSchema = z.object(contactFieldsShape);

/** For partial updates: an omitted key must mean "leave untouched," not
 *  "clear it" — conflating the two silently wipes every field the caller
 *  didn't mention. Pass a value from a `.partial()`-parsed object. */
export function updateField<T>(value: T | null | undefined): T | null | undefined {
  return value === undefined ? undefined : value || null;
}
