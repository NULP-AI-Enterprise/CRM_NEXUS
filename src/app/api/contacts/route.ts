import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ContactCategory } from "@/generated/prisma/enums";

const contactInputSchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  role: z.string().trim().max(200).nullish(),
  companyId: z.string().min(1).nullish(),
  category: z.nativeEnum(ContactCategory).optional(),
  usefulnessScore: z.number().int().min(1).max(10).nullish(),
  temperament: z.string().trim().max(2000).nullish(),
  needs: z.string().trim().max(2000).nullish(),
  valuePotential: z.string().trim().max(2000).nullish(),
  fullSummary: z.string().trim().max(5000).nullish(),
});

export async function POST(request: Request) {
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

  const { companyId, role, temperament, needs, valuePotential, fullSummary, ...rest } = parsed.data;

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

  const contact = await prisma.contact.create({
    data: {
      userId: session.user.id,
      fullName: parsed.data.fullName,
      role: role || null,
      companyId: companyId || null,
      companyName,
      category: rest.category ?? ContactCategory.OTHER,
      usefulnessScore: rest.usefulnessScore ?? null,
      temperament: temperament || null,
      needs: needs || null,
      valuePotential: valuePotential || null,
      fullSummary: fullSummary || null,
    },
    include: { company: true },
  });

  return NextResponse.json({ contact }, { status: 201 });
}
