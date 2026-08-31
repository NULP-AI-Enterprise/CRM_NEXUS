import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCommunityGraphData } from "@/lib/data/communities";
import { listContactsBasic } from "@/lib/data/contacts";
import { getOrgHistoryData } from "@/lib/data/timeline";
import { entityKey, entityLabel, nowIso } from "@/lib/timeline-entity";
import { getServerTranslation } from "@/lib/i18n/server";
import { CommunityHeader } from "@/components/dashboard/community-header";
import { CommunityProfileView } from "@/components/dashboard/community-profile-view";
import { HistoryGraphView } from "@/components/timeline/history-graph-view";

type CommunityPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: CommunityPageProps): Promise<Metadata> {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return {};

  const community = await prisma.community.findFirst({ where: { id, userId: session.user.id }, select: { name: true } });
  return { title: community ? `${community.name} — Knowledge Graph CRM` : "Community — CRM" };
}

export default async function CommunityPage({ params }: CommunityPageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const [community, data, orgHistory, allContacts, { t }] = await Promise.all([
    prisma.community.findFirst({ where: { id, userId: session.user.id } }),
    getCommunityGraphData(session.user.id, id),
    getOrgHistoryData(session.user.id, "community", id),
    listContactsBasic(session.user.id),
    getServerTranslation(),
  ]);
  if (!community || !data || !orgHistory) {
    notFound();
  }

  const memberIds = new Set(data.members.map((m) => m.id));
  const availableContacts = allContacts.filter((c) => !memberIds.has(c.id));

  const pinnedEntities = [
    { key: entityKey({ kind: "community", community }), label: entityLabel({ kind: "community", community }) },
    ...data.members.map((m) => ({
      key: entityKey({ kind: "contact", contact: { id: m.id, fullName: m.fullName, category: m.category } }),
      label: m.fullName,
    })),
  ];

  return (
    <div className="flex flex-col gap-5 pb-12">
      <div className="flex items-center gap-1.5 text-[11.5px] text-[#8c8c86]">
        <Link href="/communities" className="font-medium hover:text-foreground transition-colors">
          {t("dashboard.tab.communities")}
        </Link>
        <span>/</span>
        <span className="font-medium text-foreground">{community.name}</span>
      </div>

      <div className="rounded-[18px] border border-border bg-card overflow-hidden">
        <CommunityHeader community={community} />
        <CommunityProfileView data={data} availableContacts={availableContacts} />
      </div>

      <div className="rounded-[18px] border border-border bg-card p-5">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground">{t("cluster.title")}</div>
        <div className="h-[560px] overflow-hidden rounded-[14px] border border-border">
          <HistoryGraphView events={orgHistory.events} connections={orgHistory.connections} nowIso={nowIso()} pinnedEntities={pinnedEntities} />
        </div>
      </div>
    </div>
  );
}
