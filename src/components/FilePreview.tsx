import { getTranslations } from "next-intl/server";
import { DocxPreview } from "@/components/DocxPreview";
import { Card } from "@/components/ui/card";
import { buildYouTubeEmbedUrl, buildYouTubeWatchUrl } from "@/lib/documents/youtube";
import { resolvePreviewKind } from "@/lib/documents/preview-kind";
import type { DocumentRecord } from "@/types/document";

type FilePreviewProps = {
  documentId: string;
  fileCategory: DocumentRecord["fileCategory"];
  mimeType: string | null;
  fileName: string | null;
  /** FEAT-12B */
  sourceType: DocumentRecord["sourceType"];
  /** FEAT-12B: the validated video id — only ever read when sourceType is YOUTUBE. */
  externalVideoId: string | null;
};

function PlaceholderCard({ message }: { message: string }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-2 border-dashed bg-surface px-6 py-16 text-center">
      <p className="text-sm text-muted">{message}</p>
    </Card>
  );
}

/** Renders the right preview UI for a document's file. Public — the preview API it points at requires no auth. */
export async function FilePreview({
  documentId,
  fileCategory,
  mimeType,
  fileName,
  sourceType,
  externalVideoId,
}: FilePreviewProps) {
  const kind = resolvePreviewKind(sourceType, fileCategory, mimeType);
  const previewUrl = `/api/documents/${documentId}/preview`;
  const tPreview = await getTranslations("preview");

  switch (kind) {
    case "none":
      return <PlaceholderCard message={tPreview("notAvailable")} />;

    case "youtube": {
      // Defensive only — every YOUTUBE document is created with a validated
      // video id (see uploadDocument), so this null case should be
      // unreachable in practice.
      if (!externalVideoId) {
        return <PlaceholderCard message={tPreview("videoNotAvailable")} />;
      }
      const embedUrl = buildYouTubeEmbedUrl(externalVideoId);
      const watchUrl = buildYouTubeWatchUrl(externalVideoId);
      return (
        <div className="flex flex-col gap-2">
          <Card className="overflow-hidden bg-ink p-0">
            <iframe
              src={embedUrl}
              title={fileName ?? tPreview("youtubeVideoTitle")}
              className="aspect-video w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </Card>
          <a
            href={watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-accent-strong hover:underline"
          >
            {tPreview("openOnYouTube")}
          </a>
        </div>
      );
    }

    case "word-legacy":
      return <PlaceholderCard message={tPreview("wordLegacyNotAvailable")} />;

    case "excel":
      return <PlaceholderCard message={tPreview("excelNotAvailable")} />;

    case "pdf":
      return (
        <div className="flex flex-col gap-2">
          {fileCategory === "POWERPOINT" ? (
            <p className="text-xs text-muted">{tPreview("powerpointPdfNotice")}</p>
          ) : null}
          <Card className="overflow-hidden p-0">
            <iframe src={previewUrl} title={fileName ?? tPreview("documentPreviewTitle")} className="h-[70vh] w-full" />
          </Card>
        </div>
      );

    case "image":
      return (
        <Card className="flex items-center justify-center overflow-hidden bg-surface p-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- served from our own preview API, not a static asset Next can optimize */}
          <img
            src={previewUrl}
            alt={fileName ?? tPreview("documentPreviewTitle")}
            className="max-h-[70vh] w-auto max-w-full object-contain"
          />
        </Card>
      );

    case "video":
      return (
        <Card className="overflow-hidden bg-ink p-0">
          <video controls preload="metadata" className="max-h-[70vh] w-full" src={previewUrl}>
            {tPreview("browserNoVideoSupport")}
          </video>
        </Card>
      );

    case "docx":
      return (
        <Card className="overflow-hidden p-0">
          <DocxPreview previewUrl={previewUrl} />
        </Card>
      );
  }
}
