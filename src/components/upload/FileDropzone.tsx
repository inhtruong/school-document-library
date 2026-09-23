"use client";

import { useState, type ChangeEvent, type DragEvent } from "react";
import { FileText, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { validateSelectedFile } from "@/components/upload/file-size-validation";
import { cn } from "@/lib/utils";

type FileDropzoneProps = {
  id: string;
  name: string;
  accept: string;
  required?: boolean;
  /** Shown in the caption — e.g. "PDF, Word, Excel, images, or video". */
  acceptedFormatsLabel: string;
  maxSizeMB: number;
};

function formatFileSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The file is the literal subject of this page, so it gets real visual
 * presence instead of a bare native picker at the bottom of a long list of
 * fields. Stays a normal uncontrolled file input under the hood — the
 * surrounding Server Action form still reads it via `formData.get(name)`
 * exactly as before; this only changes how choosing/dropping a file looks
 * and feels. The input covers the whole zone (transparent, not display:
 * none) so native click/keyboard/drag-drop semantics all keep working
 * for free — the browser already assigns a dropped file to a file input's
 * `.files` on its own, no manual DataTransfer wiring needed.
 */
export function FileDropzone({ id, name, accept, required, acceptedFormatsLabel, maxSizeMB }: FileDropzoneProps) {
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  // SEC-B-03-FIX-04: defense-in-depth UX only — the backend's own
  // `file.size > MAX_UPLOAD_SIZE_BYTES` check (uploadDocument()) remains
  // the real security boundary and is unchanged by this.
  const [isOversized, setIsOversized] = useState(false);
  const tUpload = useTranslations("upload");
  const tErrors = useTranslations("errors.codes");

  function handleDrag(event: DragEvent<HTMLDivElement>, over: boolean) {
    event.preventDefault();
    setIsDragOver(over);
  }

  /**
   * The ONE onChange handler for both the file picker and drag/drop (a
   * dropped file lands in this same native input's `.files`, per the
   * component doc comment above) — routes through the shared
   * `validateSelectedFile()` so both entry points reject oversized files
   * identically. An oversized selection is never stored in `file` state
   * AND the native input itself is cleared, so it can never end up in the
   * form's FormData on submit even if the user tries anyway.
   */
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const result = validateSelectedFile(event.target.files?.[0], maxSizeMB * 1024 * 1024);

    if (result.status === "oversized") {
      event.currentTarget.value = "";
      setFile(null);
      setIsOversized(true);
      return;
    }

    setIsOversized(false);
    setFile(result.status === "accepted" ? result.file : null);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink">{tUpload("documentFile")}</span>
      <div
        onDragEnter={(event) => handleDrag(event, true)}
        onDragOver={(event) => handleDrag(event, true)}
        onDragLeave={(event) => handleDrag(event, false)}
        onDrop={(event) => handleDrag(event, false)}
        className={cn(
          "relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
          isDragOver ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-accent/40"
        )}
      >
        <input
          id={id}
          name={name}
          type="file"
          accept={accept}
          required={required}
          aria-label={tUpload("documentFile")}
          aria-invalid={isOversized || undefined}
          onChange={handleChange}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />

        {file ? (
          <div className="flex w-full max-w-xs items-center gap-3 rounded-xl bg-card px-4 py-3 text-left shadow-sm">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
              <FileText className="h-[18px] w-[18px] text-accent" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{file.name}</p>
              <p className="text-xs text-muted">
                {formatFileSize(file.size)} · {tUpload("clickToChange")}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent-soft">
              <Upload className="h-6 w-6 text-accent" aria-hidden />
            </div>
            <p className="text-sm font-medium text-ink">{tUpload("dragDropText")}</p>
            <p className="text-xs text-muted">
              {acceptedFormatsLabel} · {tUpload("upToSize", { size: maxSizeMB })}
            </p>
          </>
        )}
      </div>

      {isOversized ? (
        <span role="alert" className="text-xs text-destructive">
          {tErrors("uploadFileTooLarge", { size: maxSizeMB })}
        </span>
      ) : null}
    </div>
  );
}
