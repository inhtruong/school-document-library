import { describe, expect, test } from "vitest";
import { rateDocumentSchema } from "@/lib/validation/rating";

describe("rateDocumentSchema", () => {
  test.each([1, 2, 3, 4, 5])("accepts %i", (value) => {
    expect(rateDocumentSchema.safeParse({ value }).success).toBe(true);
  });

  test.each([
    ["0", { value: 0 }],
    ["6", { value: 6 }],
    ["a negative value", { value: -1 }],
    ["a decimal", { value: 3.5 }],
    ["a string", { value: "3" }],
    ["null", { value: null }],
    ["a missing value", {}],
  ])("rejects %s", (_label, body) => {
    expect(rateDocumentSchema.safeParse(body).success).toBe(false);
  });
});
