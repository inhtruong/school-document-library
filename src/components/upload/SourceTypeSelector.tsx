"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ClipboardList, Upload, Video } from "lucide-react";
import { FileDropzone } from "@/components/upload/FileDropzone";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SourceType = "FILE" | "YOUTUBE" | "GOOGLE_FORM";

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
        className="inline-flex w-fit gap-1 rounded-xl border border-line bg-surface p-1"
        role="radiogroup"
        aria-label={tUpload("contentSource")}
      >
        {(
          [
            { value: "FILE" as const, label: tUpload("uploadFile"), Icon: Upload },
            { value: "YOUTUBE" as const, label: tUpload("youtubeVideo"), Icon: Video },
            { value: "GOOGLE_FORM" as const, label: tUpload("googleForm"), Icon: ClipboardList },
          ]
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={sourceType === option.value}
            onClick={() => setSourceType(option.value)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
              sourceType === option.value ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink"
            )}
          >
            <option.Icon className="h-4 w-4" aria-hidden />
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
      ) : sourceType === "YOUTUBE" ? (
        <label className="flex flex-col gap-1.5 text-sm" htmlFor="upload-youtubeUrl">
          {tUpload("youtubeUrlLabel")}
          <div className="relative">
            <Video className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input
              id="upload-youtubeUrl"
              name="youtubeUrl"
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              required
              className="pl-9"
            />
          </div>
          <span className="text-xs font-normal text-muted">{tUpload("youtubeUrlHelp")}</span>
        </label>
      ) : (
        <label className="flex flex-col gap-1.5 text-sm" htmlFor="upload-googleFormUrl">
          {tUpload("googleFormUrlLabel")}
          <div className="relative">
            <ClipboardList
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <Input
              id="upload-googleFormUrl"
              name="googleFormUrl"
              type="url"
              placeholder="https://docs.google.com/forms/d/e/.../viewform"
              required
              className="pl-9"
            />
          </div>
          <span className="text-xs font-normal text-muted">{tUpload("googleFormUrlHelp")}</span>
        </label>
      )}
    </div>
  );
}
