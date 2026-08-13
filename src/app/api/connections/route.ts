import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/rate-limit";

const createConnectionSchema = z.object({
  fromContactId: z.string().min(1),
  toContactId: z.string().min(1),
  relationship: z.string().optional(),
  strength: z.number().int().min(1).max(5).default(1),
  notes: z.string().optional(),
});

const deleteConnectionSchema = z.object({
  id: z.string().optional(),
  fromContactId: z.string().optional(),
  toContactId: z.string().optional(),
});

export async function POST(req: Request) {
  const rl = checkRateLimit("apiGeneral", getClientIp(req.headers));
  if (rl.limited) return rateLimitedResponse(rl.retryAfterSeconds);

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const json = await req.json();
    const parsed = createConnectionSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data", issues: parsed.error.issues }, { status: 400 });
    }

    const { fromContactId, toContactId, relationship, strength, notes } = parsed.data;

    if (fromContactId === toContactId) {
      return NextResponse.json({ error: "Cannot connect a contact to themselves" }, { status: 400 });
    }

    // Verify both contacts belong to user
    const [fromContact, toContact] = await Promise.all([
      prisma.contact.findFirst({ where: { id: fromContactId, userId: session.user.id } }),
      prisma.contact.findFirst({ where: { id: toContactId, userId: session.user.id } }),
    ]);

    if (!fromContact || !toContact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    // Upsert connection
    const connection = await prisma.contactConnection.upsert({
      where: {
        fromContactId_toContactId: {
          fromContactId,
          toContactId,
        },
      },
      update: {
        relationship: relationship ?? undefined,
        strength: strength ?? 1,
        notes: notes ?? undefined,
      },
      create: {
        userId: session.user.id,
        fromContactId,
        toContactId,
        relationship: relationship ?? "Зв'язок",
        strength: strength ?? 1,
        notes: notes ?? null,
      },
      include: {
        fromContact: true,
        toContact: true,
      },
    });

    return NextResponse.json({ success: true, connection });
  } catch (error) {
    console.error("Error creating connection:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const rl = checkRateLimit("apiGeneral", getClientIp(req.headers));
  if (rl.limited) return rateLimitedResponse(rl.retryAfterSeconds);

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const json = await req.json();
    const parsed = deleteConnectionSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    const { id, fromContactId, toContactId } = parsed.data;

    if (id) {
      await prisma.contactConnection.deleteMany({
        where: {
          id,
          userId: session.user.id,
        },
      });
    } else if (fromContactId && toContactId) {
      await prisma.contactConnection.deleteMany({
        where: {
          userId: session.user.id,
          OR: [
            { fromContactId, toContactId },
            { fromContactId: toContactId, toContactId: fromContactId },
          ],
        },
      });
    } else {
      return NextResponse.json({ error: "Missing identifier" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting connection:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
