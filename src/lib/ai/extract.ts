import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";

import { ContactExtractionSchema, type ContactExtraction } from "@/lib/ai/schema";

const INSTRUCTIONS = `Ти — асистент, який аналізує нотатки користувача про його ділові та особисті контакти
для персонального networking CRM. Отримавши необроблений текст нотатки (текст або розшифровку голосу),
витягни інформацію про особу, про яку йдеться, компанію (якщо згадана), та психологічний/ціннісний профіль.

Правила:
- Всі текстові поля виводу (temperament, needs, valuePotential, fullSummary, description) пиши ТІЄЮ Ж мовою,
  якою написано вхідний текст нотатки.
- Якщо в тексті є "Наявний профіль контакту" — це те, що вже відомо. Онови й доповни його новою нотаткою,
  а не просто повтори без змін. fullSummary має бути кумулятивним: об'єднай старе й нове в цілісний опис.
- Якщо поле не згадано і немає в наявному профілі — постав null (де це дозволено) або нейтральне значення.
- usefulnessScore: оціни від 1 (марний контакт) до 10 (надзвичайно цінний) виходячи з контексту.
- category: обери єдину найбільш відповідну категорію.
- Не вигадуй фактів, яких немає в тексті чи наявному профілі.`;

export async function extractContactInfo(params: {
  rawText: string;
  existingProfileContext?: string;
}): Promise<ContactExtraction> {
  const { rawText, existingProfileContext } = params;

  const prompt = existingProfileContext
    ? `Наявний профіль контакту:\n${existingProfileContext}\n\nНова нотатка про цей контакт:\n${rawText}`
    : `Нова нотатка про контакт:\n${rawText}`;

  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: ContactExtractionSchema,
    schemaName: "ContactExtraction",
    schemaDescription: "Structured extraction of a networking contact from a free-text note.",
    instructions: INSTRUCTIONS,
    prompt,
    temperature: 0.2,
    maxOutputTokens: 1000,
  });

  return object;
}
