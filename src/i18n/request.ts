import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { LOCALE_COOKIE_NAME, resolveLocale } from "@/i18n/locales";

/**
 * FEAT-13: next-intl's request config, used WITHOUT next-intl's own i18n
 * routing (no `[locale]` segment, no locale-prefixed URLs, no next-intl
 * middleware) — see the FEAT-13 audit for why: this app's existing URLs
 * (/documents/[id], /login, /upload, /moderation, /admin/audit-log, every
 * /api/* route, Auth.js's own routes/callbacks, preview/download links)
 * must not change shape just to add a language. Locale is resolved from a
 * plain cookie instead (see set-locale-action.ts for how it's written);
 * `resolveLocale` is the one place that decides the fallback, so it's
 * covered by its own unit tests rather than only exercised indirectly here.
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
