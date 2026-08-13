import { prisma } from "@/lib/prisma";
import { extractContactInfo } from "@/lib/ai/extract";
import type { InteractionType } from "@/generated/prisma/enums";
import type { ContactModel as Contact } from "@/generated/prisma/models";

export class ContactNotFoundError extends Error {
  constructor() {
    super("Contact not found");
    this.name = "ContactNotFoundError";
  }
}

// LLMs are unreliable at exact day-of-week arithmetic ("Tuesday" from a
// Thursday has landed on the wrong date in testing). Weekday names are the
// most common and most mechanically checkable case, so once the model
// extracts one, recompute it in code rather than trust the model's math.
// Longer/more specific patterns are listed before substrings they contain
// (e.g. "понеділ" before "неділ", since "понеділок" contains "неділ").
const WEEKDAY_PATTERNS: Array<[pattern: string, dayOfWeek: number]> = [
  ["понеділ", 1],
  ["вівтор", 2],
  ["серед", 3],
  ["четвер", 4],
  ["ятниц", 5], // covers п'ятниця / п’ятниця regardless of apostrophe variant
  ["субот", 6],
  ["неділ", 0],
  ["monday", 1],
  ["tuesday", 2],
  ["wednesday", 3],
  ["thursday", 4],
  ["friday", 5],
  ["saturday", 6],
  ["sunday", 0],
];

function detectMentionedWeekday(text: string): number | null {
  const lower = text.toLowerCase();
  for (const [pattern, dayOfWeek] of WEEKDAY_PATTERNS) {
    if (lower.includes(pattern)) return dayOfWeek;
  }
  return null;
}

/** The next occurrence of `dayOfWeek` strictly after `from` (never today). */
function nextOccurrenceOf(dayOfWeek: number, from: Date): Date {
  const result = new Date(from);
  result.setHours(0, 0, 0, 0);
  const diff = ((dayOfWeek - result.getDay() + 7) % 7) || 7;
  result.setDate(result.getDate() + diff);
  return result;
}

function resolveFollowUpDate(followUp: string | null, modelDate: string | null): Date | null {
  const mentionedDow = followUp ? detectMentionedWeekday(followUp) : null;
  if (mentionedDow != null) {
    return nextOccurrenceOf(mentionedDow, new Date());
  }
  if (!modelDate) return null;
  const parsed = new Date(modelDate);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function buildExistingProfileContext(contact: Contact): string {
  const lines = [
    `Ім'я: ${contact.fullName}`,
    contact.role ? `Посада: ${contact.role}` : null,
    contact.companyName ? `Компанія: ${contact.companyName}` : null,
    `Категорія: ${contact.category}`,
    contact.usefulnessScore != null ? `Рейтинг корисності: ${contact.usefulnessScore}/10` : null,
    contact.temperament ? `Характер: ${contact.temperament}` : null,
    contact.needs ? `Потреби: ${contact.needs}` : null,
    contact.valuePotential ? `Потенційна цінність: ${contact.valuePotential}` : null,
    contact.fullSummary ? `Саммарі: ${contact.fullSummary}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

export async function processInteraction(params: {
  userId: string;
  rawText: string;
  type: InteractionType;
  contactId?: string;
}) {
  const { userId, rawText, type, contactId } = params;

  let existingContact: Contact | null = null;
  if (contactId) {
    existingContact = await prisma.contact.findFirst({
      where: { id: contactId, userId },
    });
    if (!existingContact) {
      throw new ContactNotFoundError();
    }
  }

  const extraction = await extractContactInfo({
    rawText,
    existingProfileContext: existingContact ? buildExistingProfileContext(existingContact) : undefined,
  });

  const companyName = extraction.person.companyName?.trim() || null;

  return prisma.$transaction(async (tx) => {
    let companyId: string | null = existingContact?.companyId ?? null;

    if (companyName) {
      const foundCompany = await tx.company.findFirst({
        where: { userId, name: { equals: companyName, mode: "insensitive" } },
      });

      if (foundCompany) {
        companyId = foundCompany.id;
        if (!foundCompany.industry || !foundCompany.description) {
          await tx.company.update({
            where: { id: foundCompany.id },
            data: {
              industry: foundCompany.industry ?? extraction.company?.industry ?? undefined,
              description: foundCompany.description ?? extraction.company?.description ?? undefined,
            },
          });
        }
      } else {
        const created = await tx.company.create({
          data: {
            userId,
            name: companyName,
            industry: extraction.company?.industry ?? null,
            description: extraction.company?.description ?? null,
          },
        });
        companyId = created.id;
      }
    }

    const profileData = {
      role: extraction.person.role ?? undefined,
      companyName: companyName ?? undefined,
      companyId: companyId ?? undefined,
      usefulnessScore: extraction.profile.usefulnessScore,
      category: extraction.profile.category,
      temperament: extraction.profile.temperament,
      needs: extraction.profile.needs,
      valuePotential: extraction.profile.valuePotential,
      fullSummary: extraction.fullSummary,
    };

    let contactId2: string;
    if (existingContact) {
      const updated = await tx.contact.update({
        where: { id: existingContact.id },
        data: profileData,
      });
      contactId2 = updated.id;
    } else {
      const foundContact = await tx.contact.findFirst({
        where: { userId, fullName: { equals: extraction.person.fullName, mode: "insensitive" } },
      });

      if (foundContact) {
        const updated = await tx.contact.update({
          where: { id: foundContact.id },
          data: profileData,
        });
        contactId2 = updated.id;
      } else {
        const created = await tx.contact.create({
          data: {
            userId,
            fullName: extraction.person.fullName,
            ...profileData,
          },
        });
        contactId2 = created.id;
      }
    }

    await tx.interaction.create({
      data: {
        contactId: contactId2,
        type,
        rawText,
        followUp: extraction.followUp,
        followUpDate: resolveFollowUpDate(extraction.followUp, extraction.followUpDate),
      },
    });

    return tx.contact.findUniqueOrThrow({
      where: { id: contactId2 },
      include: {
        company: true,
        interactions: { orderBy: { createdAt: "desc" } },
      },
    });
  });
}
