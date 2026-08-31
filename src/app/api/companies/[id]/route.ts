import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/rate-limit";
import { companyInputSchema, updateField } from "@/lib/validation/company";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const rl = checkRateLimit("apiGeneral", getClientIp(request.headers));
  if (rl.limited) return rateLimitedResponse(rl.retryAfterSeconds);

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.company.findFirst({ where: { id, userId: session.user.id } });
  if (!existing) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // .partial(): an inline single-field edit (e.g. just industry) must not
  // wipe name/description — see the identical comment on the contacts route.
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
        userId: session.user.id,
        id: { not: id },
        name: { equals: parsed.data.name, mode: "insensitive" },
      },
    });
    if (duplicate) {
      return NextResponse.json({ error: "duplicate" }, { status: 409 });
    }
  }

  const company = await prisma.company.update({
    where: { id },
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

  // Keep contacts' cached companyName in sync with the rename (only fires
  // when name was actually part of this update).
  if (parsed.data.name !== undefined) {
    await prisma.contact.updateMany({
      where: { companyId: id },
      data: { companyName: company.name },
    });
  }

  return NextResponse.json({ company });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const rl = checkRateLimit("apiGeneral", getClientIp(request.headers));
  if (rl.limited) return rateLimitedResponse(rl.retryAfterSeconds);

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.company.findFirst({ where: { id, userId: session.user.id } });
  if (!existing) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  await prisma.company.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
