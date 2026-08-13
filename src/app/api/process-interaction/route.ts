import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { InteractionType } from "@/generated/prisma/enums";
import { ContactNotFoundError, processInteraction } from "@/lib/services/process-interaction";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/rate-limit";

const RequestSchema = z.object({
  rawText: z.string().trim().min(1, "Текст не може бути порожнім.").max(8000),
  type: z.nativeEnum(InteractionType).default("NOTE"),
  contactId: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  const rl = checkRateLimit("aiProcessInteraction", getClientIp(request.headers));
  if (rl.limited) return rateLimitedResponse(rl.retryAfterSeconds);

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  try {
    const contact = await processInteraction({
      userId: session.user.id,
      rawText: parsed.data.rawText,
      type: parsed.data.type,
      contactId: parsed.data.contactId,
    });

    return NextResponse.json({ contact }, { status: 200 });
  } catch (error) {
    if (error instanceof ContactNotFoundError) {
      return NextResponse.json({ error: "Contact not found." }, { status: 404 });
    }

    console.error("process-interaction failed:", error);
    return NextResponse.json(
      { error: "Не вдалося обробити нотатку. Спробуйте ще раз." },
      { status: 500 },
    );
  }
}
