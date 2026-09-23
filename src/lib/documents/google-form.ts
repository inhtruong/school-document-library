import "server-only";

/** Exact hostnames only — never a substring/suffix match, which would let `docs.google.com.evil.com` or `evil.com/docs.google.com` slip through. Same defensive convention as youtube.ts's ALLOWED_HOSTS. */
const ALLOWED_HOSTS = new Set(["docs.google.com", "forms.gle"]);

/**
 * Parses a user-submitted string into a validated, normalized Google Form
 * URL, or `null` for anything that doesn't clearly and safely resolve to
 * one. Deliberately conservative — this is the ONLY place a client-
 * submitted Google Form URL is ever interpreted, and the returned value is
 * the only thing ever stored/rendered (see `uploadDocument()`), never the
 * raw original string.
 *
 * Unlike `extractYouTubeVideoId()`, a Google Form has no short canonical id
 * to reduce the URL to — a `docs.google.com/forms/...` path or a
 * `forms.gle` short slug IS the identifier — so this returns a normalized
 * URL string (rebuilt through the `URL` parser, dropping any hash
 * fragment) rather than a bare id. The query string is preserved, since
 * Google Forms' own pre-filled-link feature legitimately relies on it.
 *
 * Uses the real `URL` parser (never a hand-rolled regex over the whole
 * string) specifically so host-spoofing tricks like
 * `https://docs.google.com.evil.com/forms/...` or
 * `https://evil.com/docs.google.com/forms/...` can't slip past a naive
 * substring check — only an exact, allowlisted `hostname` ever passes.
 */
export function extractGoogleFormUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    try {
      url = new URL(`https://${trimmed}`);
    } catch {
      return null;
    }
  }

  // HTTPS only — rejects http:, javascript:, data:, file:, and every other
  // scheme outright, before any host/path check runs.
  if (url.protocol !== "https:") return null;

  const host = url.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) return null;

  if (host === "docs.google.com") {
    // Require the path to actually represent a Google Forms URL — rejects
    // a Google Docs/Sheets/Slides link on the same host (e.g.
    // /document/d/... or /spreadsheets/d/...), which this app has no use
    // for and should not silently accept as "a Google Form".
    if (!url.pathname.startsWith("/forms/")) return null;
  } else {
    // forms.gle: require a non-empty path — the bare host with no slug
    // isn't a real form link.
    const slug = url.pathname.split("/").filter(Boolean)[0];
    if (!slug) return null;
  }

  // Rebuilt from the parsed URL, not the raw input string — normalizes
  // casing/encoding quirks and drops any hash fragment, while preserving
  // the query string (Google Forms' pre-filled-link feature depends on it).
  return `${url.protocol}//${url.host}${url.pathname}${url.search}`;
}
