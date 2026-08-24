import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getCompanyGraphData } from "@/lib/data/companies";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/rate-limit";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const rl = checkRateLimit("apiGeneral", getClientIp(request.headers));
  if (rl.limited) return rateLimitedResponse(rl.retryAfterSeconds);

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const data = await getCompanyGraphData(session.user.id, id);
    if (!data) {
      return NextResponse.json({ error: "Company not found." }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch company graph data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
