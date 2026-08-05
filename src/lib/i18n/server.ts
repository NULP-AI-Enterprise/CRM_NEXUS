import { cookies } from "next/headers";

import { DEFAULT_LOCALE, LOCALE_COOKIE, translate, type DictionaryKey, type Locale } from "@/lib/i18n/dictionary";

export async function getServerLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return value === "uk" || value === "en" ? value : DEFAULT_LOCALE;
}

export async function getServerTranslation() {
  const locale = await getServerLocale();
  const t = (key: DictionaryKey, vars?: Record<string, string | number>) => translate(key, locale, vars);
  return { locale, t };
}
