"use client";

import { useTransition } from "react";
import { Check, Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setLocaleAction } from "@/lib/i18n/set-locale-action";
import type { Locale } from "@/i18n/locales";
import { cn } from "@/lib/utils";

type LanguageSwitcherProps = {
  currentLocale: Locale;
  /** Translated accessible label ("Language"/"Ngôn ngữ") — passed as a prop, resolved server-side by SiteHeader, same convention as AccountMenu/MobileMenu. */
  label: string;
};

/**
 * FEAT-13: language names are deliberately NOT translated — "Tiếng Việt"
 * and "English" are each shown in their own native form regardless of the
 * current UI language, which is the standard, more recognizable pattern
 * for a language switcher (someone who can't read the current language
 * can still find their own).
 */
const LANGUAGE_OPTIONS: { locale: Locale; nativeName: string }[] = [
  { locale: "vi", nativeName: "Tiếng Việt" },
  { locale: "en", nativeName: "English" },
];

/**
 * Always visible (no `hidden md:` gating) so it works identically on mobile
 * and desktop without needing a second copy inside MobileMenu. Switching
 * never navigates: `setLocaleAction` only writes a cookie, then
 * `router.refresh()` re-renders the current route (Server Components
 * re-run with the new locale) with the exact same path and query string —
 * this is what "preserve the current page/query params" reduces to when
 * there's no locale-prefixed URL to redirect between.
 */
export function LanguageSwitcher({ currentLocale, label }: LanguageSwitcherProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSelect(locale: Locale) {
    if (locale === currentLocale || isPending) return;
    startTransition(async () => {
      await setLocaleAction(locale);
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        disabled={isPending}
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-card text-ink outline-none transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 md:h-9 md:w-9"
      >
        <Languages className="h-4 w-4" aria-hidden />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        {LANGUAGE_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.locale}
            aria-current={option.locale === currentLocale}
            onSelect={() => handleSelect(option.locale)}
            className={cn("justify-between", option.locale === currentLocale && "font-medium text-ink")}
          >
            {option.nativeName}
            {option.locale === currentLocale ? <Check className="h-4 w-4 text-accent" aria-hidden /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
