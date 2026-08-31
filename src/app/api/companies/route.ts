import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/rate-limit";
import { companyInputSchema } from "@/lib/validation/company";

export async function POST(request: Request) {
  const rl = checkRateLimit("apiGeneral", getClientIp(request.headers));
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

  const parsed = companyInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  const existing = await prisma.company.findFirst({
    where: { userId: session.user.id, name: { equals: parsed.data.name, mode: "insensitive" } },
  });
  if (existing) {
    return NextResponse.json({ error: "duplicate" }, { status: 409 });
  }

  const company = await prisma.company.create({
    data: {
      userId: session.user.id,
      name: parsed.data.name,
      industry: parsed.data.industry || null,
      description: parsed.data.description || null,
      linkedin: parsed.data.linkedin || null,
      phone: parsed.data.phone || null,
      city: parsed.data.city || null,
      country: parsed.data.country || null,
      usefulnessScore: parsed.data.usefulnessScore ?? null,
      needs: parsed.data.needs || null,
      valuePotential: parsed.data.valuePotential || null,
      fullSummary: parsed.data.fullSummary || null,
    },
  });

  return NextResponse.json({ company }, { status: 201 });
}
