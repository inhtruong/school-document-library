"use client";

import { useState, type DragEvent } from "react";
import { FileText, Upload } from "lucide-react";
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

  function handleDrag(event: DragEvent<HTMLDivElement>, over: boolean) {
    event.preventDefault();
    setIsDragOver(over);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink">Document file</span>
      <div
        onDragEnter={(event) => handleDrag(event, true)}
        onDragOver={(event) => handleDrag(event, true)}
        onDragLeave={(event) => handleDrag(event, false)}
        onDrop={(event) => handleDrag(event, false)}
        className={cn(
          "relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
          isDragOver ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-ink/25"
        )}
      >
        <input
          id={id}
          name={name}
          type="file"
          accept={accept}
          required={required}
          aria-label="Document file"
          onChange={(event) => {
            const selected = event.target.files?.[0];
            setFile(selected ? { name: selected.name, size: selected.size } : null);
          }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />

        {file ? (
          <>
            <FileText className="h-6 w-6 text-accent" aria-hidden />
            <p className="max-w-full truncate text-sm font-medium text-ink">{file.name}</p>
            <p className="text-xs text-muted">{formatFileSize(file.size)} · Click to change file</p>
          </>
        ) : (
          <>
            <Upload className="h-6 w-6 text-muted" aria-hidden />
            <p className="text-sm font-medium text-ink">Drag a file here, or click to browse</p>
            <p className="text-xs text-muted">
              {acceptedFormatsLabel} · up to {maxSizeMB} MB
            </p>
          </>
        )}
      </div>
    </div>
  );
}
