import { describe, expect, test } from "vitest";
import { COMMENT_MAX_LENGTH } from "@/lib/documents/comment-config";
import { commentContentSchema } from "@/lib/validation/comment";

describe("commentContentSchema", () => {
  test("accepts normal content", () => {
    expect(commentContentSchema.safeParse({ content: "Great resource, thanks!" }).success).toBe(true);
  });

  test("trims surrounding whitespace", () => {
    const result = commentContentSchema.safeParse({ content: "  hello  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.content).toBe("hello");
  });

  test("rejects an empty comment", () => {
    expect(commentContentSchema.safeParse({ content: "" }).success).toBe(false);
  });

  test("rejects a whitespace-only comment", () => {
    expect(commentContentSchema.safeParse({ content: "     " }).success).toBe(false);
  });

  test("accepts content exactly at the max length", () => {
    expect(commentContentSchema.safeParse({ content: "x".repeat(COMMENT_MAX_LENGTH) }).success).toBe(true);
  });

  test("rejects content over the max length", () => {
    const result = commentContentSchema.safeParse({ content: "x".repeat(COMMENT_MAX_LENGTH + 1) });
    expect(result.success).toBe(false);
  });

  test.each([
    ["a number", { content: 123 }],
    ["null", { content: null }],
    ["a missing value", {}],
    ["an object", { content: { evil: true } }],
  ])("rejects an invalid body type: %s", (_label, body) => {
    expect(commentContentSchema.safeParse(body).success).toBe(false);
  });
});
