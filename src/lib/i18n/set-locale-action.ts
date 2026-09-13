"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE_NAME, type Locale } from "@/i18n/locales";

/** One year, matching this app's other long-lived-but-non-auth cookie choices (this is a preference, not a session). */
const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * FEAT-13: the only way the locale cookie is ever written. Deliberately
 * does nothing else — no redirect, no revalidation call — the caller
 * (LanguageSwitcher) is expected to follow this with `router.refresh()` so
 * the current URL (path + query string) never changes, which is what
 * keeps "switch language" from ever navigating the user away from what
 * they were looking at. Never touches Auth.js's session cookie or
 * `sessionVersion` — completely orthogonal state.
 */
export async function setLocaleAction(locale: Locale): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE_NAME, locale, {
    maxAge: LOCALE_COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
  });
}
