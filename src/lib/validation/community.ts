import { z } from "zod";

/** Shared across /api/communities, the admin panel, and the MCP write tools. */
export const communityFieldsShape = {
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullish(),
};

export const communityInputSchema = z.object(communityFieldsShape);
