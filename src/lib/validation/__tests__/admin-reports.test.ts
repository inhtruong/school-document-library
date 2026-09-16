import { describe, expect, test } from "vitest";
import { updateReportStatusSchema } from "@/lib/validation/admin-reports";

describe("updateReportStatusSchema", () => {
  test.each(["RESOLVED", "DISMISSED"] as const)("accepts status %s", (status) => {
    const result = updateReportStatusSchema.safeParse({ status });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({ status });
  });

  test("rejects OPEN as a target status — never a client-supplied transition", () => {
    const result = updateReportStatusSchema.safeParse({ status: "OPEN" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe("VALIDATION_REPORT_STATUS_INVALID");
  });

  test("rejects an invalid status value", () => {
    const result = updateReportStatusSchema.safeParse({ status: "ARCHIVED" });
    expect(result.success).toBe(false);
  });

  test("rejects a missing status", () => {
    const result = updateReportStatusSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
