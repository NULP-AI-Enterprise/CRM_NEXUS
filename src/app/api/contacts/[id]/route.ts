import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ContactCategory } from "@/generated/prisma/enums";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/rate-limit";

const contactInputSchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  role: z.string().trim().max(200).nullish(),
  companyId: z.string().min(1).nullish(),
  category: z.nativeEnum(ContactCategory).optional(),
  usefulnessScore: z.number().int().min(1).max(10).nullish(),
  phone: z.string().trim().max(50).nullish(),
  linkedin: z.string().trim().max(300).nullish(),
  telegram: z.string().trim().max(100).nullish(),
  instagram: z.string().trim().max(100).nullish(),
  whatsapp: z.string().trim().max(50).nullish(),
  city: z.string().trim().max(150).nullish(),
  country: z.string().trim().max(150).nullish(),
  temperament: z.string().trim().max(2000).nullish(),
  needs: z.string().trim().max(2000).nullish(),
  valuePotential: z.string().trim().max(2000).nullish(),
  fullSummary: z.string().trim().max(5000).nullish(),
  communityIds: z.array(z.string().min(1)).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const rl = checkRateLimit("apiGeneral", getClientIp(request.headers));
  if (rl.limited) return rateLimitedResponse(rl.retryAfterSeconds);

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.contact.findFirst({ where: { id, userId: session.user.id } });
  if (!existing) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
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

  let communitiesUpdate:
    | { set: Array<{ id: string }> }
    | undefined;
  if (communityIds !== undefined) {
    let validCommunityIds: string[] = [];
    if (communityIds.length > 0) {
      const owned = await prisma.community.findMany({
        where: { id: { in: communityIds }, userId: session.user.id },
        select: { id: true },
      });
      validCommunityIds = owned.map((c) => c.id);
    }
    communitiesUpdate = { set: validCommunityIds.map((cId) => ({ id: cId })) };
  }

  const contact = await prisma.contact.update({
    where: { id },
    data: {
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
      communities: communitiesUpdate,
    },
    include: { company: true, communities: true },
  });

  return NextResponse.json({ contact });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const rl = checkRateLimit("apiGeneral", getClientIp(request.headers));
  if (rl.limited) return rateLimitedResponse(rl.retryAfterSeconds);

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.contact.findFirst({ where: { id, userId: session.user.id } });
  if (!existing) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

  await prisma.contact.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
