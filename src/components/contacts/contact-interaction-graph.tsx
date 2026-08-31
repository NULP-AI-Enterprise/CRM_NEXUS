"use client";

import { useState } from "react";
import { History, Maximize2 } from "lucide-react";

import { ClusterWorkflowDiagram } from "@/components/timeline/cluster-workflow-diagram";
import { useTranslation } from "@/lib/i18n/context";

export function ContactInteractionGraph({ entityKey }: { entityKey: string }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground uppercase tracking-wider">
        <History className="size-3.5 text-muted-foreground" />
        {t("timeline.title")}
        <button
          onClick={() => setExpanded(true)}
          title={t("cluster.expandFull")}
          aria-label={t("cluster.expandFull")}
          className="ml-auto rounded p-1 normal-case tracking-normal text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Maximize2 className="size-3.5" />
        </button>
      </div>
      <div className="h-[620px] overflow-hidden rounded-lg border border-border">
        <ClusterWorkflowDiagram variant="inline" open onOpenChange={() => {}} entityKey={entityKey} />
      </div>
      <ClusterWorkflowDiagram variant="modal" open={expanded} onOpenChange={setExpanded} entityKey={entityKey} />
    </div>
  );
}
