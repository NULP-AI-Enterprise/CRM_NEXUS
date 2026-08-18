import { z } from "zod";

/** Shared across /api/companies, the admin panel, and the MCP write tools. */
export const companyFieldsShape = {
  name: z.string().trim().min(1).max(200),
  industry: z.string().trim().max(200).nullish(),
  description: z.string().trim().max(2000).nullish(),
};

export const companyInputSchema = z.object(companyFieldsShape);
