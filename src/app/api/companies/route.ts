import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const companyInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  industry: z.string().trim().max(200).nullish(),
  description: z.string().trim().max(2000).nullish(),
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
    },
  });

  return NextResponse.json({ company }, { status: 201 });
}
