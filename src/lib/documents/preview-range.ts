export type RangeResult =
  | { type: "full" }
  | { type: "partial"; start: number; end: number }
  | { type: "invalid" };

/**
 * Parses a single `Range: bytes=start-end` request header against a known
 * file size. Pure and side-effect free so it's unit-testable without touching
 * the filesystem or a real request/response.
 *
 * - No header → "full" (serve the whole file, 200).
 * - A valid, satisfiable range → "partial" with a clamped, inclusive
 *   [start, end] (caller responds 206).
 * - Anything malformed or out of bounds → "invalid" (caller responds 416).
 *
 * Only the single-range form is supported (`bytes=0-499`, `bytes=500-`,
 * `bytes=-500`) — multi-range requests aren't something browser-native
 * video/PDF/image playback needs, so they're rejected rather than partially
 * handled.
 */
export function parseRangeHeader(rangeHeader: string | null, fileSize: number): RangeResult {
  if (!rangeHeader) return { type: "full" };

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) return { type: "invalid" };

  const [, startText, endText] = match;
  if (startText === "" && endText === "") return { type: "invalid" };

  let start: number;
  let end: number;

  if (startText === "") {
    // Suffix range, e.g. "bytes=-500" → last 500 bytes.
    const suffixLength = Number(endText);
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) return { type: "invalid" };
    start = Math.max(0, fileSize - suffixLength);
    end = fileSize - 1;
  } else {
    start = Number(startText);
    end = endText === "" ? fileSize - 1 : Number(endText);
  }

  if (!Number.isInteger(start) || !Number.isInteger(end)) return { type: "invalid" };
  if (start < 0 || end < start) return { type: "invalid" };
  if (fileSize <= 0 || start >= fileSize) return { type: "invalid" };

  return { type: "partial", start, end: Math.min(end, fileSize - 1) };
}
