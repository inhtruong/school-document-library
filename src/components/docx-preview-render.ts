export type RenderDocxResult = { success: true } | { success: false; error: unknown };

type DocxRendererModule = {
  renderAsync: (
    data: Blob,
    bodyContainer: HTMLElement,
    styleContainer?: HTMLElement,
    userOptions?: Record<string, unknown>
  ) => Promise<unknown>;
};

export type RenderDocxDeps = {
  /** Injectable for tests; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
  /** Injectable for tests; defaults to the real `docx-preview` dynamic import. */
  loadRenderer?: () => Promise<DocxRendererModule>;
};

/**
 * Fetches a document's preview bytes and renders them into `container` with
 * `docx-preview`. Kept free of React/DOM-testing concerns — a plain async
 * function over injectable dependencies — so the fetch → render → outcome
 * sequence is unit-testable without a browser. `DocxPreview` (the client
 * component) just calls this from a `useEffect` and maps the result to UI
 * state. The `docx-preview` import is dynamic so its browser-only code never
 * loads during SSR.
 */
export async function renderDocxPreview(
  previewUrl: string,
  container: HTMLElement,
  deps: RenderDocxDeps = {}
): Promise<RenderDocxResult> {
  const doFetch = deps.fetchImpl ?? fetch;
  const doLoadRenderer = deps.loadRenderer ?? (() => import("docx-preview"));

  try {
    const [{ renderAsync }, response] = await Promise.all([doLoadRenderer(), doFetch(previewUrl)]);

    if (!response.ok) {
      throw new Error(`Preview request failed with status ${response.status}`);
    }

    const blob = await response.blob();
    await renderAsync(blob, container, undefined, { className: "docx-preview", inWrapper: true });
    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
}
