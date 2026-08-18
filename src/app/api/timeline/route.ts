import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTimelineData } from "@/lib/data/timeline";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/rate-limit";

/** Account-wide event list, lightly used by BranchParentPicker to let a
 *  branch's parent be picked from anywhere in the user's history — not just
 *  the current entity's own events — which is what makes a cross-entity
 *  provenance chain pickable in the first place. */
export async function GET(request: Request) {
  const rl = checkRateLimit("apiGeneral", getClientIp(request.headers));
  if (rl.limited) return rateLimitedResponse(rl.retryAfterSeconds);

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const events = await getTimelineData(session.user.id);
    return NextResponse.json({ events });
  } catch (error) {
    console.error("Failed to fetch timeline data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
