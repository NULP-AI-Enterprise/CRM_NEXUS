import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGraphData } from "@/lib/data/graph";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const graphData = await getGraphData(session.user.id);
    return NextResponse.json(graphData);
  } catch (error) {
    console.error("Failed to fetch graph data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
