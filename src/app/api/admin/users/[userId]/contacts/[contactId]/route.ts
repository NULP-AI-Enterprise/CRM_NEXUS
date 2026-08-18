import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/rate-limit";
import { contactInputSchema, updateField } from "@/lib/validation/contact";
import { requireAdminApi } from "@/lib/admin/require-admin";
import { logAdminAction } from "@/lib/admin/audit-log";

type RouteContext = { params: Promise<{ userId: string; contactId: string }> };

// Partial + undefined-safe writes: the admin edit dialog only shows a
// working subset of fields (fullName/role/companyId/category/score), so an
// omitted key here must mean "leave untouched," never "clear it" — the same
// partial-update data-loss class already fixed once for the MCP write tools.
const contactUpdateSchema = contactInputSchema.partial();

export async function PATCH(request: Request, { params }: RouteContext) {
  const rl = checkRateLimit("adminWrite", getClientIp(request.headers));
  if (rl.limited) return rateLimitedResponse(rl.retryAfterSeconds);

  const result = await requireAdminApi();
  if ("error" in result) return result.error;
  const { session } = result;

  const { userId, contactId } = await params;
  const existing = await prisma.contact.findFirst({ where: { id: contactId, userId } });
  if (!existing) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = contactUpdateSchema.safeParse(body);
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

  let companyId_: string | null | undefined;
  let companyName: string | null | undefined;
  if (companyId !== undefined) {
    if (companyId) {
      const company = await prisma.company.findFirst({ where: { id: companyId, userId } });
      if (!company) {
        return NextResponse.json({ error: "Company not found." }, { status: 404 });
      }
      companyId_ = companyId;
      companyName = company.name;
    } else {
      companyId_ = null;
      companyName = null;
    }
  }

  let communitiesUpdate: { set: Array<{ id: string }> } | undefined;
  if (communityIds !== undefined) {
    let validCommunityIds: string[] = [];
    if (communityIds.length > 0) {
      const owned = await prisma.community.findMany({
        where: { id: { in: communityIds }, userId },
        select: { id: true },
      });
      validCommunityIds = owned.map((c) => c.id);
    }
    communitiesUpdate = { set: validCommunityIds.map((cId) => ({ id: cId })) };
  }

  const contact = await prisma.contact.update({
    where: { id: contactId },
    data: {
      fullName: parsed.data.fullName,
      role: updateField(role),
      companyId: companyId_,
      companyName,
      phone: updateField(phone),
      linkedin: updateField(linkedin),
      telegram: updateField(telegram),
      instagram: updateField(instagram),
      whatsapp: updateField(whatsapp),
      city: updateField(city),
      country: updateField(country),
      category: rest.category,
      usefulnessScore: rest.usefulnessScore,
      temperament: updateField(temperament),
      needs: updateField(needs),
      valuePotential: updateField(valuePotential),
      fullSummary: updateField(fullSummary),
      communities: communitiesUpdate,
    },
    include: { company: true, communities: true },
  });

  await logAdminAction({
    adminUserId: session.user.id,
    targetUserId: userId,
    entityType: "Contact",
    entityId: contact.id,
    action: "update",
  });

  return NextResponse.json({ contact });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const rl = checkRateLimit("adminWrite", getClientIp(request.headers));
  if (rl.limited) return rateLimitedResponse(rl.retryAfterSeconds);

  const result = await requireAdminApi();
  if ("error" in result) return result.error;
  const { session } = result;

  const { userId, contactId } = await params;
  const existing = await prisma.contact.findFirst({ where: { id: contactId, userId } });
  if (!existing) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

  await prisma.contact.delete({ where: { id: contactId } });

  await logAdminAction({
    adminUserId: session.user.id,
    targetUserId: userId,
    entityType: "Contact",
    entityId: contactId,
    action: "delete",
  });

  return NextResponse.json({ success: true });
}
