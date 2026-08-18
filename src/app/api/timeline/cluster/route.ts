import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getClusterDiagramData } from "@/lib/data/cluster";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const rl = checkRateLimit("apiGeneral", getClientIp(request.headers));
  if (rl.limited) return rateLimitedResponse(rl.retryAfterSeconds);

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entityKey = new URL(request.url).searchParams.get("entityKey");
  if (!entityKey) {
    return NextResponse.json({ error: "Missing entityKey" }, { status: 400 });
  }

  try {
    const data = await getClusterDiagramData(session.user.id, entityKey);
    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch cluster diagram data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
