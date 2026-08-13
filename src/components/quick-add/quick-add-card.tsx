"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VoiceInputButton } from "@/components/quick-add/voice-input-button";
import { useTranslation } from "@/lib/i18n/context";

export function QuickAddCard() {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleTranscript = (chunk: string) => {
    setText((prev) => (prev ? `${prev} ${chunk}` : chunk));
  };

  const handleSubmit = () => {
    const rawText = text.trim();
    if (!rawText) {
      toast.error(t("quickAdd.emptyError"));
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/process-interaction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawText }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error ?? t("quickAdd.processError"));
        }
        toast.success(t("quickAdd.savedToast", { name: data.contact.fullName }));
        setText("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("quickAdd.processError"));
      }
    });
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-zinc-900/40 p-4 transition-colors">
      <div className="flex items-center justify-between pb-2">
        <div>
          <h2 className="text-xs font-semibold text-white tracking-tight uppercase tracking-wider text-zinc-400">
            {t("quickAdd.title")}
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">{t("quickAdd.description")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-1">
        <div className="relative flex items-stretch gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("quickAdd.placeholder")}
            className="min-h-18 flex-1 resize-none rounded-lg border-white/[0.08] bg-zinc-950/60 p-3 text-base md:text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:ring-0"
            disabled={isPending}
          />
          <div className="flex flex-col justify-start">
            <VoiceInputButton onTranscript={handleTranscript} disabled={isPending} />
          </div>
        </div>

        <div className="flex items-center justify-between pt-0.5">
          <span className="text-[11px] text-zinc-500">{t("quickAdd.audioTextSupport")}</span>

          <Button
            onClick={handleSubmit}
            disabled={isPending || !text.trim()}
            className="bg-white hover:bg-zinc-200 text-zinc-950 rounded-md px-3.5 h-7 text-xs font-medium gap-1.5 transition-colors"
          >
            {isPending ? <Loader2 className="size-3 animate-spin" /> : <ArrowRight className="size-3" />}
            {isPending ? t("quickAdd.submitPending") : t("quickAdd.submit")}
          </Button>
        </div>
      </div>
    </div>
  );
}
