"use client";

import { useTranslation } from "@/lib/i18n/context";

export function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation();

  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-border bg-card p-0.5 text-[11px] font-medium">
      <button
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
        className={`rounded px-1.5 py-0.5 transition-colors ${
          locale === "en" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLocale("uk")}
        aria-pressed={locale === "uk"}
        className={`rounded px-1.5 py-0.5 transition-colors ${
          locale === "uk" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        UA
      </button>
    </div>
  );
}
