import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FileSpreadsheet, FileText, Image as ImageIcon, PlayCircle, Presentation } from "lucide-react";
import { Card } from "@/components/ui/card";
import { documentTypeMessageKey } from "@/lib/documents/document-type";
import type { DocumentRecord } from "@/types/document";

type LatestDocumentCardProps = {
  doc: DocumentRecord;
};

/** Real source/file type only — same convention duplicated across documents/[id], SearchResultCard, and my-uploads (no shared export exists — see their own comments). */
function fileTypeIcon(doc: Pick<DocumentRecord, "sourceType" | "fileCategory">) {
  if (doc.sourceType === "YOUTUBE") return PlayCircle;
  switch (doc.fileCategory) {
    case "EXCEL":
      return FileSpreadsheet;
    case "POWERPOINT":
      return Presentation;
    case "IMAGE":
      return ImageIcon;
    case "VIDEO":
      return PlayCircle;
    case "PDF":
    case "WORD":
    default:
      return FileText;
  }
}

/**
 * UI-7F homepage-only compact card — deliberately NOT a reuse of
 * `SearchResultCard` (UI-7A, `/search`'s styling must stay stable) or the
 * shared `DocumentCard` (also rendered by `/saved`). The whole card is ONE
 * `<Link>` (same accessible pattern as `DocumentCard`) — no nested
 * interactive elements.
 */
export default async function LatestDocumentCard({ doc }: LatestDocumentCardProps) {
  const tDocumentType = await getTranslations("documentType");
  const Icon = fileTypeIcon(doc);
  const subjectLabel = doc.subjectRef ? doc.subjectRef.name : doc.subject;

  return (
    <Link
      href={`/documents/${doc.id}`}
      className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <Card className="flex h-full flex-col overflow-hidden transition-all group-hover:-translate-y-px group-hover:border-ink/20 group-hover:shadow-[0_6px_16px_rgba(28,25,23,0.07)]">
        <div className="flex h-24 items-center justify-center bg-accent-soft">
          <Icon className="h-8 w-8 text-accent" aria-hidden />
        </div>
        <div className="flex flex-1 flex-col gap-1 p-4">
          <span className="text-xs font-medium text-accent">
            {tDocumentType(documentTypeMessageKey(doc.documentType))}
          </span>
          <h3 className="line-clamp-2 font-display text-sm font-medium leading-snug text-ink">{doc.title}</h3>
          <p className="mt-auto flex flex-wrap items-center gap-x-1.5 pt-1 text-xs text-muted">
            {doc.grade ? <span>{doc.grade.name}</span> : null}
            {doc.grade ? (
              <span aria-hidden className="text-muted">
                ·
              </span>
            ) : null}
            <span>{subjectLabel}</span>
          </p>
        </div>
      </Card>
    </Link>
  );
}
