import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ContactCategory } from "@/generated/prisma/enums";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/rate-limit";
import { contactInputSchema } from "@/lib/validation/contact";

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

  const parsed = contactInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  const {
    companyId,
    role,
    phone,
    linkedin,
    telegram,
    instagram,
    whatsapp,
    city,
    country,
    temperament,
    needs,
    valuePotential,
    fullSummary,
    communityIds,
    ...rest
  } = parsed.data;

  let companyName: string | null = null;
  if (companyId) {
    const company = await prisma.company.findFirst({
      where: { id: companyId, userId: session.user.id },
    });
    if (!company) {
      return NextResponse.json({ error: "Company not found." }, { status: 404 });
    }
    companyName = company.name;
  }

  let validCommunityIds: string[] = [];
  if (communityIds && communityIds.length > 0) {
    const owned = await prisma.community.findMany({
      where: { id: { in: communityIds }, userId: session.user.id },
      select: { id: true },
    });
    validCommunityIds = owned.map((c) => c.id);
  }

  const contact = await prisma.contact.create({
    data: {
      userId: session.user.id,
      fullName: parsed.data.fullName,
      role: role || null,
      companyId: companyId || null,
      companyName,
      phone: phone || null,
      linkedin: linkedin || null,
      telegram: telegram || null,
      instagram: instagram || null,
      whatsapp: whatsapp || null,
      city: city || null,
      country: country || null,
      category: rest.category ?? ContactCategory.OTHER,
      usefulnessScore: rest.usefulnessScore ?? null,
      temperament: temperament || null,
      needs: needs || null,
      valuePotential: valuePotential || null,
      fullSummary: fullSummary || null,
      communities: { connect: validCommunityIds.map((id) => ({ id })) },
    },
    include: { company: true, communities: true },
  });

  return NextResponse.json({ contact }, { status: 201 });
}
