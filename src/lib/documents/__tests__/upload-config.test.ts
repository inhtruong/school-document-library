import { describe, expect, test } from "vitest";
import {
  computeUploadBodySizeLimit,
  MAX_UPLOAD_SIZE_BYTES,
  MAX_UPLOAD_SIZE_MB,
  UPLOAD_BODY_SIZE_LIMIT,
} from "@/lib/documents/upload-config";

describe("computeUploadBodySizeLimit — SEC-B-03-FIX-02", () => {
  test("the production business requirement (30 MiB) derives 32mb of transport headroom", () => {
    expect(computeUploadBodySizeLimit(30)).toBe("32mb");
  });

  test("stays correctly derived for a different MAX_UPLOAD_SIZE_MB value, not hardcoded to 30", () => {
    expect(computeUploadBodySizeLimit(10)).toBe("12mb");
    expect(computeUploadBodySizeLimit(25)).toBe("27mb");
    expect(computeUploadBodySizeLimit(100)).toBe("102mb");
  });

  test("always exactly 2 more than the input, regardless of value", () => {
    for (const mb of [1, 5, 30, 50, 250]) {
      expect(computeUploadBodySizeLimit(mb)).toBe(`${mb + 2}mb`);
    }
  });
});

describe("UPLOAD_BODY_SIZE_LIMIT — single source of truth for both Next.js body limits", () => {
  test("is derived from the SAME MAX_UPLOAD_SIZE_MB the app's business validator uses — never a second, independent value", () => {
    expect(UPLOAD_BODY_SIZE_LIMIT).toBe(computeUploadBodySizeLimit(MAX_UPLOAD_SIZE_MB));
  });

  test("the app's business FILE-size limit (MAX_UPLOAD_SIZE_BYTES) is exactly MAX_UPLOAD_SIZE_MB — never MAX_UPLOAD_SIZE_MB + 2", () => {
    // Guards against the exact mistake this task explicitly forbids: the
    // application's own validator must stay at the business limit, only
    // the Next.js transport-layer limits get the +2mb headroom.
    expect(MAX_UPLOAD_SIZE_BYTES).toBe(MAX_UPLOAD_SIZE_MB * 1024 * 1024);
  });

  test("has the 'Nmb' string shape Next.js's SizeLimit config type expects (number + 'mb', e.g. '32mb')", () => {
    expect(UPLOAD_BODY_SIZE_LIMIT).toMatch(/^\d+mb$/);
  });
});
