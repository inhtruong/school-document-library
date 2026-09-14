// Stub for "next-intl/server" during Vitest runs.
// The real module ultimately reads the request locale via `next/headers`,
// which only works inside an actual Next.js request lifecycle — never when
// a route handler is invoked directly the way every route test in this
// repo does (they mock `@/auth` rather than exercising real Next.js request
// plumbing). This stub reads the real message catalogs so tests still
// exercise real translated text, with the locale controlled explicitly via
// `__setTestLocale()` rather than an unusable cookie.
import en from "@/i18n/messages/en.json";
import vi from "@/i18n/messages/vi.json";

type Locale = "vi" | "en";
type Messages = Record<string, unknown>;

let testLocale: Locale = "vi";

/** Test-only escape hatch — call before invoking a route handler/business function to simulate a request locale. */
export function __setTestLocale(locale: Locale): void {
  testLocale = locale;
}

/** Test-only escape hatch — resets to the app's default locale; call in `afterEach` to avoid leaking state across tests. */
export function __resetTestLocale(): void {
  testLocale = "vi";
}

function resolveNamespace(catalog: Messages, namespace: string): Messages {
  const resolved = namespace.split(".").reduce<unknown>((obj, part) => {
    if (obj && typeof obj === "object" && part in obj) return (obj as Messages)[part];
    return undefined;
  }, catalog);
  if (!resolved || typeof resolved !== "object") {
    throw new Error(`next-intl-server-stub: unknown namespace "${namespace}"`);
  }
  return resolved as Messages;
}

/** Only plain `{name}` interpolation — none of this app's server-error messages use ICU plural/select syntax. */
function interpolate(template: string, values?: Record<string, string | number>): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

export async function getTranslations(namespace: string) {
  const catalog = testLocale === "en" ? (en as Messages) : (vi as Messages);
  const messages = resolveNamespace(catalog, namespace);

  return (key: string, values?: Record<string, string | number>): string => {
    const template = messages[key];
    if (typeof template !== "string") {
      throw new Error(`next-intl-server-stub: missing message "${namespace}.${key}"`);
    }
    return interpolate(template, values);
  };
}

export async function getLocale(): Promise<Locale> {
  return testLocale;
}
