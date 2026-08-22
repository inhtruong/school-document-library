/**
 * Builds a safe `Content-Disposition: attachment` header value for a
 * download, from the original uploaded filename (`Document.fileName` —
 * user-influenced, never `fileKey`). Never trusts it verbatim: strips
 * control characters/newlines (header injection / response splitting), and
 * escapes quotes/backslashes in the ASCII `filename` fallback. Also emits
 * the RFC 5987 `filename*=UTF-8''...` parameter so non-ASCII names survive
 * intact in browsers that support it.
 */
export function buildContentDisposition(fileName: string): string {
  const cleaned = fileName.replace(/[\r\n\x00-\x1f]/g, "").trim() || "download";

  const asciiFallback =
    cleaned
      .replace(/[^\x20-\x7e]/g, "_")
      .replace(/[\\"]/g, "_")
      .trim() || "download";

  const encoded = encodeURIComponent(cleaned).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
