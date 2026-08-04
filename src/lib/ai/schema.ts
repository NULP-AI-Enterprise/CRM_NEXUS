import { z } from "zod";

import { ContactCategory } from "@/generated/prisma/enums";

export const ContactExtractionSchema = z.object({
  person: z.object({
    fullName: z.string().describe("Full name of the person the note is about."),
    role: z
      .string()
      .nullable()
      .describe("Their job title / role. Null if not mentioned."),
    companyName: z
      .string()
      .nullable()
      .describe("Name of the company they currently work at. Null if not mentioned."),
  }),
  company: z
    .object({
      industry: z
        .string()
        .nullable()
        .describe("Industry of the company, if it can be inferred."),
      description: z
        .string()
        .nullable()
        .describe("Short one or two sentence description of the company, if known."),
    })
    .nullable()
    .describe("Extra info about the company if one was mentioned in the text, otherwise null."),
  profile: z.object({
    usefulnessScore: z
      .number()
      .int()
      .min(1)
      .max(10)
      .describe("How useful/valuable this contact is to us, from 1 (not useful) to 10 (extremely valuable), inferred from context."),
    category: z
      .nativeEnum(ContactCategory)
      .describe("Best-fit category for this contact."),
    temperament: z
      .string()
      .describe("Short characterization of their personality/attitude, e.g. friendly, skeptical, demanding, loyal, hostile, neutral."),
    needs: z
      .string()
      .describe("What this person needs or wants from us."),
    valuePotential: z
      .string()
      .describe("What value or help this person could realistically provide to us."),
  }),
  fullSummary: z
    .string()
    .describe(
      "A thorough, well-structured summary of who this person is, combining all prior context with this new note: background, relationship history, key facts, and current state.",
    ),
});

export type ContactExtraction = z.infer<typeof ContactExtractionSchema>;
