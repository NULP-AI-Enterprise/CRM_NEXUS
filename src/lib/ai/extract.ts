import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";

import { ContactExtractionSchema, type ContactExtraction } from "@/lib/ai/schema";

const INSTRUCTIONS = `Ти — асистент, який аналізує нотатки користувача про його ділові та особисті контакти
для персонального networking CRM. Отримавши необроблений текст нотатки (текст або розшифровку голосу),
витягни інформацію про особу, про яку йдеться, компанію (якщо згадана), та психологічний/ціннісний профіль.

Правила:
- Визнач мову вхідного тексту нотатки: англійська чи українська. Всі текстові поля виводу
  (temperament, needs, valuePotential, fullSummary, description, followUp) пиши ЛИШЕ цією мовою —
  повністю англійською або повністю українською, без змішування мов в межах одного поля.
  Якщо вхідний текст написаний іншою мовою або мову не можна впевнено визначити — пиши українською
  (мова за замовчуванням). Це стосується навіть кумулятивного fullSummary: якщо існуючий профіль
  був іншою мовою, при оновленні перепиши його цією ж (визначеною для нової нотатки) мовою.
- Якщо в тексті є "Наявний профіль контакту" — це те, що вже відомо. Онови й доповни його новою нотаткою,
  а не просто повтори без змін. fullSummary має бути кумулятивним: об'єднай старе й нове в цілісний опис.
- Якщо поле не згадано і немає в наявному профілі — постав null (де це дозволено) або нейтральне значення.
- usefulnessScore: оціни від 1 (марний контакт) до 10 (надзвичайно цінний) виходячи з контексту.
- category: обери єдину найбільш відповідну категорію.
- followUp: якщо в НОВІЙ нотатці згадано конкретний план/домовленість/дію на майбутнє
  (напр. "в середу поговорить з власником академії"), витягни це одним коротким реченням,
  зі згадкою часу, якщо він є. Базуй це ТІЛЬКИ на новій нотатці, а не на наявному профілі.
  Якщо нової майбутньої дії не згадано — постав null, не вигадуй.
- followUpDate: якщо followUp не null і містить часовий вираз, що можна перевести в конкретну дату
  (напр. "в середу", "у п'ятницю", "через тиждень", "15 серпня") — виходячи з поточної дати, вказаної
  нижче, обчисли АБСОЛЮТНУ дату у форматі YYYY-MM-DD. Відносні дні тижня ("середа") завжди означають
  НАЙБЛИЖЧУ майбутню середу від поточної дати. Якщо followUp це null, або часовий вираз нечіткий
  ("незабаром", "потім") — постав null.
- Не вигадуй фактів, яких немає в тексті чи наявному профілі.`;

export async function extractContactInfo(params: {
  rawText: string;
  existingProfileContext?: string;
  today?: Date;
}): Promise<ContactExtraction> {
  const { rawText, existingProfileContext, today = new Date() } = params;

  const todayIso = today.toISOString().slice(0, 10);
  const contextBlock = existingProfileContext
    ? `Наявний профіль контакту:\n${existingProfileContext}\n\n`
    : "";
  const prompt = `Поточна дата: ${todayIso}\n\n${contextBlock}Нова нотатка про контакт:\n${rawText}`;

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
