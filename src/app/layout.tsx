import type { Metadata } from "next";
import { Instrument_Sans, Onest, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/lib/i18n/context";
import { getServerTranslation } from "@/lib/i18n/server";

// Weave's reference design uses a single grotesque — Instrument Sans — for both
// headings and body. Instrument Sans on Google Fonts only ships latin/latin-ext,
// so it renders the (English) UI pixel-perfect but has no Cyrillic glyphs. Onest
// is loaded alongside purely as the Cyrillic fallback: the font stack in
// globals.css lists Instrument Sans first, then Onest, so Ukrainian text picks
// up Onest (a near-identical geometric grotesque) glyph-by-glyph automatically.
const fontSans = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const fontCyrillic = Onest({
  variable: "--font-onest",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const fontMono = IBM_Plex_Mono({
  variable: "--font-mono-ibm",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslation();
  return {
    title: "Nexus CRM — Knowledge Graph & Relationship Intelligence",
    description: t("app.description"),
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { locale } = await getServerTranslation();

  return (
    <html
      lang={locale}
      className={`${fontSans.variable} ${fontCyrillic.variable} ${fontMono.variable} h-full antialiased font-sans`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground tracking-[-0.01em]">
        <I18nProvider initialLocale={locale}>
          {children}
          <Toaster theme="light" position="bottom-right" richColors />
        </I18nProvider>
      </body>
    </html>
  );
}

