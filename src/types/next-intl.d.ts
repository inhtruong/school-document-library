import type en from "@/i18n/messages/en.json";
import type { Locale } from "@/i18n/locales";

/**
 * FEAT-13: next-intl's official global augmentation point — gives
 * `getLocale()`/`useLocale()` our actual `"vi" | "en"` union instead of a
 * bare `string`, and gives `useTranslations()`/`getTranslations()` type
 * checking + autocomplete against the real message-key shape (using `en`
 * as the reference shape; both locale files are still verified to have
 * identical key sets by a dedicated runtime test, since this only checks
 * the shape of one of them at compile time). Augments "use-intl", not
 * "next-intl" — `AppConfig` is actually declared in next-intl's `use-intl`
 * peer dependency (next-intl re-exports it), confirmed by reading its
 * shipped .d.ts files rather than assuming.
 */
declare module "use-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof en;
  }
}
