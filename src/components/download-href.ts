import { documentLoginHref } from "@/lib/auth/document-login-href";

/**
 * Decides what the Download button should link to — pure, so the
 * guest/authenticated/no-file branching is testable without rendering
 * `DownloadButton`. `null` means "no file, keep the button disabled."
 */
export function resolveDownloadHref(
  documentId: string,
  hasFile: boolean,
  isAuthenticated: boolean
): string | null {
  if (!hasFile) return null;
  if (!isAuthenticated) return documentLoginHref(documentId);

  return `/api/documents/${documentId}/download`;
}
