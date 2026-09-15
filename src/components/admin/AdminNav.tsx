"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type AdminNavItem = {
  href: string;
  label: string;
  /** Future CRUD destinations (FEAT-15B/C/D/E) that don't exist yet — rendered as non-clickable text, never a broken link. */
  disabled?: boolean;
};

type AdminNavProps = {
  items: AdminNavItem[];
  comingSoonLabel: string;
  ariaLabel: string;
};

/**
 * The one Client Component boundary in the Admin layout — active-route
 * highlighting genuinely needs `usePathname()`, which has no Server
 * Component equivalent in the App Router. Everything else in the Admin
 * area (layout shell, dashboard) stays a Server Component.
 */
export function AdminNav({ items, comingSoonLabel, ariaLabel }: AdminNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label={ariaLabel} className="flex flex-col gap-0.5">
      {items.map((item) => {
        if (item.disabled) {
          return (
            <span
              key={item.href}
              aria-disabled="true"
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-muted/50"
            >
              {item.label}
              <span className="text-[10px] font-medium uppercase tracking-wide">{comingSoonLabel}</span>
            </span>
          );
        }

        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              isActive ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface hover:text-ink"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
