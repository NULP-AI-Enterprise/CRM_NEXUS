import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getGraphData } from "@/lib/data/graph";
import { NetworkGraph } from "@/components/graph/network-graph";

export const metadata: Metadata = {
  title: "Граф зв'язків — Knowledge Graph CRM",
};

export default async function NetworkPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const graphData = await getGraphData(session.user.id);

  return (
    <div className="flex flex-col gap-4 pb-12">
      <Suspense fallback={<div className="h-[70vh] max-h-[700px] min-h-[420px] rounded-xl border border-border bg-muted" />}>
        <NetworkGraph initialData={graphData} />
      </Suspense>
    </div>
  );
}
