import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getTimelineData } from "@/lib/data/timeline";
import { getUpcomingFollowUps } from "@/lib/timeline-entity";
import { ActivityPageView } from "@/components/dashboard/activity-page-view";

export const metadata: Metadata = {
  title: "Нагадування — Knowledge Graph CRM",
};

export default async function ActivityPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const events = await getTimelineData(session.user.id);
  const followUps = getUpcomingFollowUps(events);

  return <ActivityPageView followUps={followUps} />;
}
