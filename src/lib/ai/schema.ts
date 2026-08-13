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
  followUp: z
    .string()
    .nullable()
    .describe(
      "A concrete next step, plan, or commitment mentioned in THIS note for the future (e.g. 'Wednesday: will talk to the academy owner'). Include the timeframe if one was mentioned. Null if this note doesn't mention any future action or plan — do not invent one.",
    ),
  followUpDate: z
    .string()
    .nullable()
    .describe(
      "The absolute date (YYYY-MM-DD) that followUp's timeframe resolves to, given today's date from the prompt context (e.g. 'Wednesday' resolves to the date of the next upcoming Wednesday). Null whenever followUp is null, or if it has no resolvable date (e.g. 'soon', 'later').",
    ),
});

export type ContactExtraction = z.infer<typeof ContactExtractionSchema>;
