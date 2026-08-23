import { describe, expect, test } from "vitest";
import { REPORT_DESCRIPTION_MAX_LENGTH } from "@/lib/documents/report-config";
import { createReportSchema } from "@/lib/validation/report";

describe("createReportSchema", () => {
  test("accepts a valid reason with no description", () => {
    const result = createReportSchema.safeParse({ reason: "BROKEN_FILE" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ reason: "BROKEN_FILE", description: null });
  });

  test("rejects an invalid reason", () => {
    expect(createReportSchema.safeParse({ reason: "NOT_A_REAL_REASON" }).success).toBe(false);
  });

  test("accepts an optional description for a normal reason", () => {
    const result = createReportSchema.safeParse({ reason: "WRONG_CONTENT", description: "The subject is wrong" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.description).toBe("The subject is wrong");
  });

  test("rejects OTHER without a description", () => {
    expect(createReportSchema.safeParse({ reason: "OTHER" }).success).toBe(false);
  });

  test("rejects OTHER with a whitespace-only description", () => {
    expect(createReportSchema.safeParse({ reason: "OTHER", description: "     " }).success).toBe(false);
  });

  test("accepts OTHER with a real description", () => {
    const result = createReportSchema.safeParse({ reason: "OTHER", description: "Something specific" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.description).toBe("Something specific");
  });

  test("accepts a description exactly at the max length", () => {
    expect(
      createReportSchema.safeParse({ reason: "BROKEN_FILE", description: "x".repeat(REPORT_DESCRIPTION_MAX_LENGTH) })
        .success
    ).toBe(true);
  });

  test("rejects a description over the max length", () => {
    expect(
      createReportSchema.safeParse({
        reason: "BROKEN_FILE",
        description: "x".repeat(REPORT_DESCRIPTION_MAX_LENGTH + 1),
      }).success
    ).toBe(false);
  });

  test("stores XSS-like content as plain text without rejecting or transforming it specially", () => {
    const payload = "<script>alert(1)</script>";
    const result = createReportSchema.safeParse({ reason: "OTHER", description: payload });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.description).toBe(payload);
  });

  test("rejects a missing reason", () => {
    expect(createReportSchema.safeParse({}).success).toBe(false);
  });
});
