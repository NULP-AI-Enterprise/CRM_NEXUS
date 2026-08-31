import { z } from "zod";

/** Shared across /api/communities, the admin panel, and the MCP write tools. */
export const communityFieldsShape = {
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullish(),
  linkedin: z.string().trim().max(300).nullish(),
  phone: z.string().trim().max(50).nullish(),
  city: z.string().trim().max(150).nullish(),
  country: z.string().trim().max(150).nullish(),
  usefulnessScore: z.number().int().min(1).max(10).nullish(),
  needs: z.string().trim().max(2000).nullish(),
  valuePotential: z.string().trim().max(2000).nullish(),
  fullSummary: z.string().trim().max(5000).nullish(),
};

export const communityInputSchema = z.object(communityFieldsShape);

/** For partial updates: an omitted key must mean "leave untouched," not
 *  "clear it" — conflating the two silently wipes every field the caller
 *  didn't mention. Pass a value from a `.partial()`-parsed object. */
export function updateField<T>(value: T | null | undefined): T | null | undefined {
  return value === undefined ? undefined : value || null;
}
