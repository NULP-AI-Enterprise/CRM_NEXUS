import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { ContactCategory } from "@/generated/prisma/enums";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/rate-limit";
import { contactInputSchema } from "@/lib/validation/contact";
import { requireAdminApi } from "@/lib/admin/require-admin";
import { logAdminAction } from "@/lib/admin/audit-log";

type RouteContext = { params: Promise<{ userId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const rl = checkRateLimit("adminWrite", getClientIp(request.headers));
  if (rl.limited) return rateLimitedResponse(rl.retryAfterSeconds);

  const result = await requireAdminApi();
  if ("error" in result) return result.error;
  const { session } = result;

  const { userId } = await params;

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
    const company = await prisma.company.findFirst({ where: { id: companyId, userId } });
    if (!company) {
      return NextResponse.json({ error: "Company not found." }, { status: 404 });
    }
    companyName = company.name;
  }

  let validCommunityIds: string[] = [];
  if (communityIds && communityIds.length > 0) {
    const owned = await prisma.community.findMany({
      where: { id: { in: communityIds }, userId },
      select: { id: true },
    });
    validCommunityIds = owned.map((c) => c.id);
  }

  const contact = await prisma.contact.create({
    data: {
      userId,
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

  await logAdminAction({
    adminUserId: session.user.id,
    targetUserId: userId,
    entityType: "Contact",
    entityId: contact.id,
    action: "create",
  });

  return NextResponse.json({ contact }, { status: 201 });
}
