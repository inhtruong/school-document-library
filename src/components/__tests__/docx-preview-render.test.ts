import { describe, expect, test, vi } from "vitest";
import { renderDocxPreview } from "@/components/docx-preview-render";

// A plain object stands in for the DOM container — renderDocxPreview never
// touches it directly, only passes it through to the (mocked) renderer.
const fakeContainer = {} as HTMLElement;

function fakeResponse(overrides: Partial<{ ok: boolean; status: number; blob: () => Promise<Blob> }> = {}) {
  return {
    ok: true,
    status: 200,
    blob: async () => new Blob(["fake docx bytes"]),
    ...overrides,
  } as Response;
}

describe("renderDocxPreview", () => {
  test("fetches the preview URL and hands the blob to the renderer on success", async () => {
    const renderAsync = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse());

    const result = await renderDocxPreview("/api/documents/doc_1/preview", fakeContainer, {
      fetchImpl,
      loadRenderer: async () => ({ renderAsync }),
    });

    expect(result).toEqual({ success: true });
    expect(fetchImpl).toHaveBeenCalledWith("/api/documents/doc_1/preview");
    expect(renderAsync).toHaveBeenCalledTimes(1);
    const [blobArg, containerArg] = renderAsync.mock.calls[0];
    expect(blobArg).toBeInstanceOf(Blob);
    expect(containerArg).toBe(fakeContainer);
  });

  test("returns a failure result (not a throw) when the fetch response is not ok", async () => {
    const renderAsync = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse({ ok: false, status: 404 }));

    const result = await renderDocxPreview("/api/documents/missing/preview", fakeContainer, {
      fetchImpl,
      loadRenderer: async () => ({ renderAsync }),
    });

    expect(result.success).toBe(false);
    expect(renderAsync).not.toHaveBeenCalled();
  });

  test("returns a failure result (not a throw) when fetch itself rejects", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));

    const result = await renderDocxPreview("/api/documents/doc_1/preview", fakeContainer, {
      fetchImpl,
      loadRenderer: async () => ({ renderAsync: vi.fn() }),
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBeInstanceOf(Error);
  });

  test("returns a failure result (not a throw) when the renderer itself throws", async () => {
    const renderAsync = vi.fn().mockRejectedValue(new Error("corrupt zip"));
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse());

    const result = await renderDocxPreview("/api/documents/doc_1/preview", fakeContainer, {
      fetchImpl,
      loadRenderer: async () => ({ renderAsync }),
    });

    expect(result.success).toBe(false);
  });
});
