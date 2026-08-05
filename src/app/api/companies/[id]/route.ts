import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const companyInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  industry: z.string().trim().max(200).nullish(),
  description: z.string().trim().max(2000).nullish(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
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

  const parsed = companyInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

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

  const company = await prisma.company.update({
    where: { id },
    data: {
      name: parsed.data.name,
      industry: parsed.data.industry || null,
      description: parsed.data.description || null,
    },
  });

  // Keep contacts' cached companyName in sync with the rename.
  await prisma.contact.updateMany({
    where: { companyId: id },
    data: { companyName: company.name },
  });

  return NextResponse.json({ company });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
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
