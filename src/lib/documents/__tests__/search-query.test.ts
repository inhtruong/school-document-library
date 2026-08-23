import { describe, expect, test } from "vitest";
import { SEARCH_PAGE_SIZE, SORT_ORDER_BY, SORT_VALUES, parseSearchQuery } from "@/lib/documents/search-query";

function params(query: string): URLSearchParams {
  return new URLSearchParams(query);
}

describe("parseSearchQuery", () => {
  test("defaults sort to newest when absent", () => {
    const result = parseSearchQuery(params(""));
    expect(result.sort).toBe("newest");
  });

  test("falls back to newest for an invalid sort value", () => {
    const result = parseSearchQuery(params("sort=most_popular"));
    expect(result.sort).toBe("newest");
  });

  test("accepts every supported sort value", () => {
    for (const sort of SORT_VALUES) {
      expect(parseSearchQuery(params(`sort=${sort}`)).sort).toBe(sort);
    }
  });

  test("defaults page to 1 when absent", () => {
    expect(parseSearchQuery(params("")).page).toBe(1);
  });

  test("parses a valid page number", () => {
    expect(parseSearchQuery(params("page=3")).page).toBe(3);
  });

  test.each(["0", "-1", "1.5", "abc", ""])("normalizes invalid page %j to 1", (raw) => {
    expect(parseSearchQuery(params(`page=${raw}`)).page).toBe(1);
  });

  test("accepts a valid DocumentType", () => {
    expect(parseSearchQuery(params("documentType=EXERCISE")).documentType).toBe("EXERCISE");
  });

  test("ignores an invalid DocumentType instead of throwing", () => {
    expect(parseSearchQuery(params("documentType=NOT_REAL")).documentType).toBeUndefined();
  });

  test("normalizes an empty keyword to undefined", () => {
    expect(parseSearchQuery(params("q=   ")).search).toBeUndefined();
  });

  test("reads the keyword from q when search is absent (frontend → API translation)", () => {
    expect(parseSearchQuery(params("q=derivative")).search).toBe("derivative");
  });

  test("prefers search over q when both are present", () => {
    expect(parseSearchQuery(params("search=api-value&q=frontend-value")).search).toBe("api-value");
  });

  test("normalizes blank taxonomy IDs to undefined", () => {
    const result = parseSearchQuery(params("gradeId=  &subjectId=&lessonId=lesson_1"));
    expect(result.gradeId).toBeUndefined();
    expect(result.subjectId).toBeUndefined();
    expect(result.lessonId).toBe("lesson_1");
  });
});

describe("SORT_ORDER_BY", () => {
  test("maps every sort value to an explicit, whitelisted Prisma orderBy shape", () => {
    expect(SORT_ORDER_BY.newest).toEqual({ createdAt: "desc" });
    expect(SORT_ORDER_BY.oldest).toEqual({ createdAt: "asc" });
    expect(SORT_ORDER_BY.title_asc).toEqual({ title: "asc" });
    expect(SORT_ORDER_BY.title_desc).toEqual({ title: "desc" });
  });
});

describe("SEARCH_PAGE_SIZE", () => {
  test("is centralized at 12", () => {
    expect(SEARCH_PAGE_SIZE).toBe(12);
  });
});
