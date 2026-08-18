import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/rate-limit";

const updateInteractionSchema = z.object({
  rawText: z.string().trim().min(1).max(8000).optional(),
  type: z.nativeEnum(require("@/generated/prisma/enums").InteractionType).optional(),
  createdAt: z.string().datetime().optional(),
  followUp: z.string().trim().max(2000).nullish(),
  followUpDate: z.string().date().nullish(),
  /** Re-point (or clear, with null) which event this one branches from. */
  parentInteractionId: z.string().min(1).nullish(),
});

type RouteContext = { params: Promise<{ id: string }> };

/** An Interaction has no userId of its own — ownership is via whichever of
 * its two optional parents (Contact or ContactConnection) is set. Every
 * write here re-verifies this, same pattern as the MCP write tools. */
async function findOwnedInteraction(id: string, userId: string) {
  return prisma.interaction.findFirst({
    where: {
      id,
      OR: [{ contact: { userId } }, { connection: { userId } }],
    },
  });
}

/** Walks up from `candidateParentId` to check that `childId` isn't already an
 * ancestor of it. Re-parenting is the only operation that can close a loop in
 * the branch tree — creation can't, because a new row has no descendants yet.
 * A loop would hang every consumer that walks the chain (the diagram's depth
 * resolver, the cluster BFS), so it's rejected here rather than defended
 * against in each reader. The visited set also bounds the walk if a loop
 * somehow already exists in the data. */
async function wouldCreateCycle(childId: string, candidateParentId: string, userId: string): Promise<boolean> {
  if (childId === candidateParentId) return true;

  const seen = new Set<string>([candidateParentId]);
  let cursor: string | null = candidateParentId;

  while (cursor) {
    const node: { parentInteractionId: string | null } | null = await prisma.interaction.findFirst({
      where: { id: cursor, OR: [{ contact: { userId } }, { connection: { userId } }] },
      select: { parentInteractionId: true },
    });
    const next: string | null = node?.parentInteractionId ?? null;
    if (!next) return false;
    if (next === childId) return true;
    if (seen.has(next)) return false;
    seen.add(next);
    cursor = next;
  }

  return false;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const rl = checkRateLimit("apiGeneral", getClientIp(request.headers));
  if (rl.limited) return rateLimitedResponse(rl.retryAfterSeconds);

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await findOwnedInteraction(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "Interaction not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = updateInteractionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  // Re-parenting: the target must be one of this user's own interactions
  // (any entity — that's what makes cross-entity provenance chains possible)
  // and must not close a loop.
  const { parentInteractionId } = parsed.data;
  if (parentInteractionId) {
    const parent = await findOwnedInteraction(parentInteractionId, session.user.id);
    if (!parent) {
      return NextResponse.json({ error: "Parent interaction not found." }, { status: 404 });
    }
    if (await wouldCreateCycle(id, parentInteractionId, session.user.id)) {
      return NextResponse.json({ error: "That would make the branch loop back on itself." }, { status: 400 });
    }
  }

  const interaction = await prisma.interaction.update({
    where: { id },
    data: {
      rawText: parsed.data.rawText,
      type: parsed.data.type,
      createdAt: parsed.data.createdAt ? new Date(parsed.data.createdAt) : undefined,
      followUp: parsed.data.followUp === undefined ? undefined : parsed.data.followUp,
      followUpDate:
        parsed.data.followUpDate === undefined
          ? undefined
          : parsed.data.followUpDate
            ? new Date(parsed.data.followUpDate)
            : null,
      parentInteractionId: parentInteractionId === undefined ? undefined : parentInteractionId,
    },
  });

  return NextResponse.json({ interaction });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const rl = checkRateLimit("apiGeneral", getClientIp(request.headers));
  if (rl.limited) return rateLimitedResponse(rl.retryAfterSeconds);

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await findOwnedInteraction(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "Interaction not found." }, { status: 404 });
  }

  // Branches cascade with their parent at the DB level (schema's onDelete:
  // Cascade on the self-relation) — deleting a main-line event with branches
  // removes them too, which is the intended behavior, not a side effect to
  // guard against here.
  await prisma.interaction.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
