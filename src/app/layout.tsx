import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import SiteHeader from "@/components/SiteHeader";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display-face",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body-face",
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
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-5xl flex-col gap-1 px-5 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
            <p>Stacks — school document library</p>
            <p className="font-mono text-xs uppercase tracking-widest">
              Demo build · PostgreSQL backend
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
