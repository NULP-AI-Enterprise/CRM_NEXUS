import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getEntityCounts } from "@/lib/data/counts";
import { getGraphData } from "@/lib/data/graph";
import { getTimelineData } from "@/lib/data/timeline";
import { computeDashboardSummary } from "@/lib/dashboard-summary";
import { OverviewView } from "@/components/dashboard/overview-view";

export const metadata: Metadata = {
  title: "Мережа Зв'язків — Knowledge Graph CRM",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const [counts, graphData, timelineEvents] = await Promise.all([
    getEntityCounts(session.user.id),
    getGraphData(session.user.id),
    getTimelineData(session.user.id),
  ]);

  const summary = computeDashboardSummary(counts, graphData, timelineEvents);

  return <OverviewView summary={summary} topHubs={graphData.stats.topHubs} />;
}
