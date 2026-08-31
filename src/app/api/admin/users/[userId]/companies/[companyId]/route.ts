import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/rate-limit";
import { companyInputSchema, updateField } from "@/lib/validation/company";
import { requireAdminApi } from "@/lib/admin/require-admin";
import { logAdminAction } from "@/lib/admin/audit-log";

type RouteContext = { params: Promise<{ userId: string; companyId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const rl = checkRateLimit("adminWrite", getClientIp(request.headers));
  if (rl.limited) return rateLimitedResponse(rl.retryAfterSeconds);

  const result = await requireAdminApi();
  if ("error" in result) return result.error;
  const { session } = result;

  const { userId, companyId } = await params;
  const existing = await prisma.company.findFirst({ where: { id: companyId, userId } });
  if (!existing) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // .partial(): the admin dialog only sends name/industry/description today,
  // so a full (non-partial) parse would silently null out every other field
  // on every save — same fix as the public company route.
  const parsed = companyInputSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  if (parsed.data.name !== undefined) {
    const duplicate = await prisma.company.findFirst({
      where: {
        userId,
        id: { not: companyId },
        name: { equals: parsed.data.name, mode: "insensitive" },
      },
    });
    if (duplicate) {
      return NextResponse.json({ error: "duplicate" }, { status: 409 });
    }
  }

  const company = await prisma.company.update({
    where: { id: companyId },
    data: {
      name: parsed.data.name,
      industry: updateField(parsed.data.industry),
      description: updateField(parsed.data.description),
      linkedin: updateField(parsed.data.linkedin),
      phone: updateField(parsed.data.phone),
      city: updateField(parsed.data.city),
      country: updateField(parsed.data.country),
      usefulnessScore: updateField(parsed.data.usefulnessScore),
      needs: updateField(parsed.data.needs),
      valuePotential: updateField(parsed.data.valuePotential),
      fullSummary: updateField(parsed.data.fullSummary),
    },
  });

  await prisma.contact.updateMany({
    where: { companyId },
    data: { companyName: company.name },
  });

  await logAdminAction({
    adminUserId: session.user.id,
    targetUserId: userId,
    entityType: "Company",
    entityId: company.id,
    action: "update",
  });

  return NextResponse.json({ company });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const rl = checkRateLimit("adminWrite", getClientIp(request.headers));
  if (rl.limited) return rateLimitedResponse(rl.retryAfterSeconds);

  const result = await requireAdminApi();
  if ("error" in result) return result.error;
  const { session } = result;

  const { userId, companyId } = await params;
  const existing = await prisma.company.findFirst({ where: { id: companyId, userId } });
  if (!existing) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  await prisma.company.delete({ where: { id: companyId } });

  await logAdminAction({
    adminUserId: session.user.id,
    targetUserId: userId,
    entityType: "Company",
    entityId: companyId,
    action: "delete",
  });

  return NextResponse.json({ success: true });
}
