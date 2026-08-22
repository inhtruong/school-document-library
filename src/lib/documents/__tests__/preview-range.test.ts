import { describe, expect, test } from "vitest";
import { parseRangeHeader } from "@/lib/documents/preview-range";

describe("parseRangeHeader", () => {
  test("no header returns full", () => {
    expect(parseRangeHeader(null, 1000)).toEqual({ type: "full" });
  });

  test("a normal bytes=start-end range", () => {
    expect(parseRangeHeader("bytes=100-199", 1000)).toEqual({ type: "partial", start: 100, end: 199 });
  });

  test("an open-ended range (bytes=start-) goes to the end of the file", () => {
    expect(parseRangeHeader("bytes=900-", 1000)).toEqual({ type: "partial", start: 900, end: 999 });
  });

  test("a suffix range (bytes=-N) returns the last N bytes", () => {
    expect(parseRangeHeader("bytes=-100", 1000)).toEqual({ type: "partial", start: 900, end: 999 });
  });

  test("an end beyond the file size is clamped to the last byte", () => {
    expect(parseRangeHeader("bytes=100-999999", 1000)).toEqual({ type: "partial", start: 100, end: 999 });
  });

  test.each([
    ["bytes=", 1000],
    ["bytes=abc-def", 1000],
    ["not-a-range", 1000],
    ["bytes=500-100", 1000], // end before start
    ["bytes=2000-3000", 1000], // start beyond file size
    ["bytes=-0", 1000], // zero-length suffix
  ] as const)("invalid: %s", (header, size) => {
    expect(parseRangeHeader(header, size)).toEqual({ type: "invalid" });
  });

  test("a zero-byte file is always invalid/unsatisfiable", () => {
    expect(parseRangeHeader("bytes=0-0", 0)).toEqual({ type: "invalid" });
  });
});
