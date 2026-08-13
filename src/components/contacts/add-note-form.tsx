"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VoiceInputButton } from "@/components/quick-add/voice-input-button";
import { useTranslation } from "@/lib/i18n/context";

export function AddNoteForm({ contactId }: { contactId: string }) {
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
      toast.error(t("addNote.emptyError"));
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/process-interaction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawText, contactId }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error ?? t("addNote.processError"));
        }
        toast.success(t("addNote.savedToast"));
        setText("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("addNote.processError"));
      }
    });
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("addNote.placeholder")}
          className="min-h-20 flex-1 resize-none bg-muted border-border text-base md:text-xs text-foreground placeholder:text-muted-foreground rounded-lg focus:border-accent"
          disabled={isPending}
        />
        <div className="flex flex-col justify-start">
          <VoiceInputButton onTranscript={handleTranscript} disabled={isPending} />
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          onClick={handleSubmit}
          disabled={isPending || !text.trim()}
          className="bg-primary hover:bg-primary/90 text-primary-foreground h-7 px-3 text-xs font-medium gap-1.5 rounded-md"
        >
          {isPending ? <Loader2 className="size-3 animate-spin" /> : <ArrowRight className="size-3" />}
          {isPending ? t("addNote.submitPending") : t("addNote.submit")}
        </Button>
      </div>
    </div>
  );
}
