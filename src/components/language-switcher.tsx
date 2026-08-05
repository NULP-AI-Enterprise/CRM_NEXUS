"use client";

import { useTranslation } from "@/lib/i18n/context";

export function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation();

  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-white/[0.08] bg-zinc-900 p-0.5 text-[11px] font-medium">
      <button
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
        className={`rounded px-1.5 py-0.5 transition-colors ${
          locale === "en" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-200"
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLocale("uk")}
        aria-pressed={locale === "uk"}
        className={`rounded px-1.5 py-0.5 transition-colors ${
          locale === "uk" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-200"
        }`}
      >
        UA
      </button>
    </div>
  );
}
