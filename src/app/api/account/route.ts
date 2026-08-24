import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit";

const updateProfileSchema = z.object({
  name: z.string().trim().max(100).nullable(),
});

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = checkRateLimit("accountUpdateProfile", session.user.id);
  if (rl.limited) return rateLimitedResponse(rl.retryAfterSeconds);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const name = parsed.data.name?.trim() || null;

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { name },
    select: { name: true, email: true },
  });

  return NextResponse.json({ user });
}
