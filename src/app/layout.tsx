import type { Metadata } from "next";
import { Suspense } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Be_Vietnam_Pro, JetBrains_Mono } from "next/font/google";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import ToastListener from "@/components/ToastListener";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// One loader for both display and body — `--font-display`/`--font-body` in
// globals.css both point at this same face (see comment there). Weights
// limited to 400/500/600: that's the full set of font-normal/font-medium/
// font-semibold classes actually used anywhere in the app (no font-bold).
const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600"],
  variable: "--font-sans-face",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-face",
  display: "swap",
});

/**
 * FEAT-13: was a static `export const metadata` — now `generateMetadata`
 * (the async form Next.js supports for exactly this) so the title/
 * description can be resolved per-request from the current locale. No
 * other page defines its own `metadata`/`generateMetadata`, so this is the
 * only place that needed to change.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${beVietnamPro.variable} ${mono.variable}`}>
      <body className="flex min-h-screen flex-col">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Suspense fallback={null}>
            <ToastListener />
          </Suspense>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
