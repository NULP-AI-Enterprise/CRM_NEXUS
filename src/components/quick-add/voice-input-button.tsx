"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/context";

// The Web Speech API (SpeechRecognition / webkitSpeechRecognition) has no
// official TypeScript DOM lib typing yet, so this file works with `any`
// for the recognition instance and its events rather than hand-rolling a
// speculative type surface.
/* eslint-disable @typescript-eslint/no-explicit-any */

function getSpeechRecognitionCtor(): any {
  if (typeof window === "undefined") return undefined;
  return (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
}

export function VoiceInputButton({
  onTranscript,
  disabled,
}: {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}) {
  // Browser support never changes during the component's lifetime, so there's
  // nothing to subscribe to — this only exists to defer the check to the
  // client and keep the SSR/first-hydration render consistent (`false`).
  const isSupported = useSyncExternalStore(
    () => () => {},
    () => !!getSpeechRecognitionCtor(),
    () => false,
  );
  const { t, locale } = useTranslation();
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (!SpeechRecognitionCtor) {
      toast.error(t("voice.unsupported"));
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = locale === "uk" ? "uk-UA" : "en-US";
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript.trim()) {
        onTranscript(finalTranscript.trim());
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error !== "no-speech") {
        toast.error(t("voice.recognitionError"));
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  if (!isSupported) {
    return null;
  }

  return (
    <Button
      type="button"
      variant={isListening ? "destructive" : "outline"}
      size="icon"
      disabled={disabled}
      onClick={toggleListening}
      title={isListening ? t("voice.stop") : t("voice.start")}
      aria-pressed={isListening}
    >
      <Mic className={isListening ? "animate-pulse" : undefined} />
    </Button>
  );
}
