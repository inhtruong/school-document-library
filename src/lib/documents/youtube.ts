import "server-only";

/**
 * Real YouTube video IDs are exactly 11 characters from this set — used
 * both to validate an extracted candidate and to reject a malformed/
 * truncated/oversized id outright, never just "looks URL-shaped."
 */
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/** Exact hostnames only — never a substring/suffix match, which would let `evil-youtube.com` or `youtube.com.evil.com` slip through. */
const ALLOWED_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be"]);

/**
 * Parses a user-submitted string into a validated YouTube video id, or
 * `null` for anything that doesn't clearly and safely resolve to one.
 * Deliberately conservative — this is the ONLY place a client-submitted
 * YouTube URL is ever interpreted, and the only output ever trusted
 * downstream (the embed/watch URLs are always rebuilt from this id, never
 * from the original string — see `buildYouTubeEmbedUrl`/`buildYouTubeWatchUrl`).
 *
 * Uses the real `URL` parser (never a hand-rolled regex over the whole
 * string) specifically so host-spoofing tricks like
 * `https://youtube.com.evil.com/watch?v=...` or
 * `https://evil.com/?redirect=youtube.com` can't slip past a naive
 * substring check — only an exact, allowlisted `hostname` ever passes.
 *
 * Supports (per FEAT-12B): `youtube.com/watch?v=ID`, `www.youtube.com/watch?v=ID`,
 * `youtu.be/ID`, `youtube.com/shorts/ID` — with or without a scheme, since
 * a user pasting a URL rarely includes `https://` themselves.
 */
export function extractYouTubeVideoId(rawUrl: string): string | null {
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

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) return null;

  let candidate: string | null = null;
  if (host === "youtu.be" || host === "www.youtu.be") {
    candidate = url.pathname.split("/").filter(Boolean)[0] ?? null;
  } else {
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments[0] === "watch") {
      candidate = url.searchParams.get("v");
    } else if (segments[0] === "shorts" && segments[1]) {
      candidate = segments[1];
    }
  }

  if (!candidate) return null;
  return VIDEO_ID_PATTERN.test(candidate) ? candidate : null;
}

/** Privacy-enhanced embed origin, per FEAT-12B — never the plain youtube.com/embed host. */
export function buildYouTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

/** The canonical, human-navigable "Open on YouTube" destination — always rebuilt from the validated id, never the user's original (possibly shorts/youtu.be) URL. */
export function buildYouTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
