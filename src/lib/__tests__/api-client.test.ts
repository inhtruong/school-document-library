import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { fetchDocumentById } from "@/lib/api-client";

const mockDocument = {
  id: "doc_1",
  title: "Database Final Exam 2025",
  description: "Covers normalization and transactions.",
  subject: "Database",
  documentType: "Exam",
  academicYear: "2024-2025",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

beforeEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_APP_URL;
});

describe("fetchDocumentById", () => {
  test("returns the document when the API responds with 200", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: mockDocument, error: null }), { status: 200 })
    );

    const result = await fetchDocumentById("doc_1");

    expect(result).toEqual(mockDocument);
  });

  test("returns null instead of throwing when the API responds with 404", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ success: false, data: null, error: "Document not found" }), {
        status: 404,
      })
    );

    const result = await fetchDocumentById("missing-or-invalid-id");

    expect(result).toBeNull();
  });

  test("throws with the server's error message on a 500 response", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ success: false, data: null, error: "Failed to load document" }), {
        status: 500,
      })
    );

    await expect(fetchDocumentById("doc_1")).rejects.toThrow("Failed to load document");
  });
});
