import type { Metadata } from "next";
import { Onest, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/lib/i18n/context";
import { getServerTranslation } from "@/lib/i18n/server";

// Weave's reference design uses a single grotesque (Instrument Sans) for both
// headings and body — Instrument Sans itself has no Cyrillic coverage in
// next/font/google, so Onest stands in as the closest Cyrillic-safe match.
const fontHeading = Onest({
  variable: "--font-heading",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const fontSans = Onest({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const fontMono = IBM_Plex_Mono({
  variable: "--font-mono",
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
      className={`${fontHeading.variable} ${fontSans.variable} ${fontMono.variable} h-full antialiased font-sans`}
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

