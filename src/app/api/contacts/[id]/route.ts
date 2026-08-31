import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/rate-limit";
import { contactInputSchema, updateField } from "@/lib/validation/contact";

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

  // .partial(): every field becomes optional at the key level (its own
  // validator — min length, enum membership, etc. — still applies whenever
  // the caller does include it). An inline single-field edit sends only that
  // one key; every other key comes back `undefined` from Zod, which Prisma's
  // own convention already treats as "leave this column untouched," not
  // "clear it" — the fix for the single biggest risk of per-field autosave.
  const parsed = contactInputSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  const {
    fullName,
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
    category,
    usefulnessScore,
  } = parsed.data;

  let companyName: string | null | undefined;
  if (companyId !== undefined) {
    if (companyId) {
      const company = await prisma.company.findFirst({
        where: { id: companyId, userId: session.user.id },
      });
      if (!company) {
        return NextResponse.json({ error: "Company not found." }, { status: 404 });
      }
      companyName = company.name;
    } else {
      companyName = null;
    }
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
      fullName,
      role: updateField(role),
      companyId: companyId === undefined ? undefined : companyId || null,
      companyName,
      phone: updateField(phone),
      linkedin: updateField(linkedin),
      telegram: updateField(telegram),
      instagram: updateField(instagram),
      whatsapp: updateField(whatsapp),
      city: updateField(city),
      country: updateField(country),
      category,
      usefulnessScore: updateField(usefulnessScore),
      temperament: updateField(temperament),
      needs: updateField(needs),
      valuePotential: updateField(valuePotential),
      fullSummary: updateField(fullSummary),
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
