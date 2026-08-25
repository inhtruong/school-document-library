import type { Metadata } from "next";
import { Suspense } from "react";
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

export const metadata: Metadata = {
  title: "Stacks — School document library",
  description:
    "Search lecture notes, past exams, assignments and cheatsheets from your courses.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${beVietnamPro.variable} ${mono.variable}`}>
      <body className="flex min-h-screen flex-col">
        <Suspense fallback={null}>
          <ToastListener />
        </Suspense>
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <Toaster />
      </body>
    </html>
  );
}
