"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FileDropzone } from "@/components/upload/FileDropzone";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SourceType = "FILE" | "YOUTUBE";

type SourceTypeSelectorProps = {
  fileAccept: string;
  fileFormatsLabel: string;
  maxSizeMB: number;
};

/**
 * FEAT-12B: lets a Teacher/Admin choose between the pre-existing "upload a
 * file" flow (unchanged — still `FileDropzone` with `name="file"`) and a new
 * "YouTube video" flow (a URL text input, `name="youtubeUrl"`). Both submit
 * through the same plain `<form action={...}>` Server Action as before — this
 * component only toggles which field is visible/required and always emits a
 * `name="sourceType"` field so `uploadDocument()` can branch server-side.
 * The actual YouTube URL validation happens server-side (see
 * src/lib/documents/youtube.ts) — this is presentation only.
 */
export function SourceTypeSelector({ fileAccept, fileFormatsLabel, maxSizeMB }: SourceTypeSelectorProps) {
  const [sourceType, setSourceType] = useState<SourceType>("FILE");
  const tUpload = useTranslations("upload");

  return (
    <div className="flex flex-col gap-4">
      <input type="hidden" name="sourceType" value={sourceType} />

      <div
        className="inline-flex w-fit rounded-lg border border-line bg-surface p-1"
        role="radiogroup"
        aria-label={tUpload("contentSource")}
      >
        {(
          [
            { value: "FILE" as const, label: tUpload("uploadFile") },
            { value: "YOUTUBE" as const, label: tUpload("youtubeVideo") },
          ]
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={sourceType === option.value}
            onClick={() => setSourceType(option.value)}
            className={cn(
              "rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
              sourceType === option.value ? "bg-paper text-ink shadow-sm" : "text-muted hover:text-ink"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {sourceType === "FILE" ? (
        <FileDropzone
          id="upload-file"
          name="file"
          accept={fileAccept}
          required
          acceptedFormatsLabel={fileFormatsLabel}
          maxSizeMB={maxSizeMB}
        />
      ) : (
        <label className="flex flex-col gap-1.5 text-sm" htmlFor="upload-youtubeUrl">
          {tUpload("youtubeUrlLabel")}
          <Input
            id="upload-youtubeUrl"
            name="youtubeUrl"
            type="url"
            placeholder="https://www.youtube.com/watch?v=..."
            required
          />
          <span className="text-xs font-normal text-muted">{tUpload("youtubeUrlHelp")}</span>
        </label>
      )}
    </div>
  );
}
