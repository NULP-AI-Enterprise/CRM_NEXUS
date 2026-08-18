import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getTimelineData } from "@/lib/data/timeline";
import { getConnectionsWithNames } from "@/lib/data/connections";
import { nowIso } from "@/lib/timeline-entity";
import { HistoryGraphView } from "@/components/timeline/history-graph-view";

export const metadata: Metadata = {
  title: "Історія взаємодій — Knowledge Graph CRM",
};

export default async function TimelinePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const [timelineEvents, connections] = await Promise.all([
    getTimelineData(session.user.id),
    getConnectionsWithNames(session.user.id),
  ]);

  // No wrapper padding: this screen is a full-bleed app shell (see MainContent's
  // "bleed" mode) that manages its own internal scrolling, matching the
  // reference design's own height:100vh timeline surface.
  return <HistoryGraphView events={timelineEvents} connections={connections} nowIso={nowIso()} />;
}
