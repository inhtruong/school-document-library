import { DocxPreview } from "@/components/DocxPreview";
import { Card } from "@/components/ui/card";
import { resolvePreviewKind } from "@/lib/documents/preview-kind";
import type { DocumentRecord } from "@/types/document";

type FilePreviewProps = {
  documentId: string;
  fileCategory: DocumentRecord["fileCategory"];
  mimeType: string | null;
  fileName: string | null;
};

function PlaceholderCard({ message }: { message: string }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-2 border-dashed bg-surface px-6 py-16 text-center">
      <p className="text-sm text-muted">{message}</p>
    </Card>
  );
}

/** Renders the right preview UI for a document's file. Public — the preview API it points at requires no auth. */
export function FilePreview({ documentId, fileCategory, mimeType, fileName }: FilePreviewProps) {
  const kind = resolvePreviewKind(fileCategory, mimeType);
  const previewUrl = `/api/documents/${documentId}/preview`;

  switch (kind) {
    case "none":
      return <PlaceholderCard message="File preview is not available for this document." />;

    case "word-legacy":
      return <PlaceholderCard message="Preview is not available for legacy Word (.doc) files yet." />;

    case "excel":
      return <PlaceholderCard message="Excel spreadsheet preview is not available yet." />;

    case "pdf":
      return (
        <Card className="overflow-hidden p-0">
          <iframe src={previewUrl} title={fileName ?? "Document preview"} className="h-[70vh] w-full" />
        </Card>
      );

    case "image":
      return (
        <Card className="flex items-center justify-center overflow-hidden bg-surface p-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- served from our own preview API, not a static asset Next can optimize */}
          <img
            src={previewUrl}
            alt={fileName ?? "Document preview"}
            className="max-h-[70vh] w-auto max-w-full object-contain"
          />
        </Card>
      );

    case "video":
      return (
        <Card className="overflow-hidden bg-ink p-0">
          <video controls preload="metadata" className="max-h-[70vh] w-full" src={previewUrl}>
            Your browser does not support video playback.
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
