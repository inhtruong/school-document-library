export type SelectedFileValidation =
  | { status: "empty" }
  | { status: "accepted"; file: { name: string; size: number } }
  | { status: "oversized" };

/**
 * SEC-B-03-FIX-04: the single decision point `FileDropzone`'s onChange
 * defers to for BOTH the file picker and drag/drop — a dropped file is
 * assigned to the same native `<input>`'s `.files` by the browser, firing
 * the identical change event (see FileDropzone.tsx's own doc comment), so
 * there is no second code path to duplicate this logic in.
 *
 * Deliberately a plain `.ts` module (not exported from FileDropzone.tsx
 * itself) so it can be unit-tested directly without parsing JSX — same
 * convention already established by download-href.ts/
 * docx-preview-render.ts for other pure, component-adjacent logic.
 *
 * Strict `>` to exactly mirror the backend's own business validator
 * (`file.size > MAX_UPLOAD_SIZE_BYTES` in uploadDocument()) — a file
 * exactly at the configured maximum is valid on both sides. This is
 * defense-in-depth UX only: the backend check remains the actual
 * security boundary and is unaffected by this function.
 */
export function validateSelectedFile(
  file: File | null | undefined,
  maxSizeBytes: number
): SelectedFileValidation {
  if (!file) return { status: "empty" };
  if (file.size > maxSizeBytes) return { status: "oversized" };
  return { status: "accepted", file: { name: file.name, size: file.size } };
}
