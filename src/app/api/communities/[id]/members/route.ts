import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/rate-limit";

const addMemberSchema = z.object({ contactId: z.string().min(1) });

type RouteContext = { params: Promise<{ id: string }> };

/** Adds an existing contact to this community — additive (Prisma `connect`),
 * unlike the contact's own `communityIds` PATCH which is a full `.set()` and
 * would need the contact's whole current membership list just to add one. */
export async function POST(request: Request, { params }: RouteContext) {
  const rl = checkRateLimit("apiGeneral", getClientIp(request.headers));
  if (rl.limited) return rateLimitedResponse(rl.retryAfterSeconds);

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const community = await prisma.community.findFirst({ where: { id, userId: session.user.id } });
  if (!community) {
    return NextResponse.json({ error: "Community not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = addMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  const contact = await prisma.contact.findFirst({ where: { id: parsed.data.contactId, userId: session.user.id } });
  if (!contact) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

  await prisma.community.update({
    where: { id },
    data: { contacts: { connect: { id: contact.id } } },
  });

  return NextResponse.json({ success: true });
}
