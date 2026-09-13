/**
 * FEAT-13: the supported locale set — shared by server config
 * (src/i18n/request.ts), the locale-switching Server Action, and any
 * Client Component that needs to know the list without importing
 * next-intl's server-only APIs. Deliberately just plain constants, not a
 * config object, so this file has zero dependencies and can be imported
 * from anywhere (server or client) without pulling in "server-only".
 */
export const LOCALES = ["vi", "en"] as const;

export type Locale = (typeof LOCALES)[number];

/** vi is the default per FEAT-13's spec — every pre-existing visitor with no cookie yet sees Vietnamese. */
export const DEFAULT_LOCALE: Locale = "vi";

/** The cookie name locale preference is persisted under (see set-locale-action.ts and request.ts). Not a session/auth cookie — never touches sessionVersion or Auth.js. */
export const LOCALE_COOKIE_NAME = "NEXT_LOCALE";

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "vi" || value === "en";
}

/** Pure, unit-testable resolution: any missing/invalid cookie value falls back to the default rather than throwing or guessing from Accept-Language. */
export function resolveLocale(cookieValue: string | null | undefined): Locale {
  return isLocale(cookieValue) ? cookieValue : DEFAULT_LOCALE;
}
