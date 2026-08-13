import type { Metadata } from "next";
import { Alegreya, Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";

import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/lib/i18n/context";
import { getServerTranslation } from "@/lib/i18n/server";

const fontHeading = Alegreya({
  variable: "--font-heading",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const fontSans = Manrope({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const fontMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin", "cyrillic"],
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

