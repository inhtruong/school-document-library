import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import {
  CalendarDays,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  PlayCircle,
  Presentation,
  User,
} from "lucide-react";
import { BookmarkAction } from "@/components/BookmarkAction";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { documentTypeMessageKey } from "@/lib/documents/document-type";
import type { UploaderSummary } from "@/lib/documents/document-uploaders";
import type { DocumentRecord } from "@/types/document";

type SearchResultCardProps = {
  doc: DocumentRecord;
  /** Same batched (never per-card) lookup `/search` already did before this task. */
  uploader?: UploaderSummary;
  isAuthenticated: boolean;
  /** From the batched `getBookmarkedDocumentIds()` lookup — never a per-card query. */
  bookmarked: boolean;
};

/** Real source/file type only — a YOUTUBE-sourced document has `fileCategory: null` (see Document's schema comment on `sourceType`), so that case is checked first. */
function fileTypeIcon(doc: DocumentRecord) {
  if (doc.sourceType === "YOUTUBE") return PlayCircle;
  if (doc.sourceType === "GOOGLE_FORM") return ClipboardList;
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
 * UI-7A: a narrowly-scoped presentation variant for the redesigned
 * `/search` results grid — deliberately NOT a change to the shared
 * `DocumentCard` (still used unmodified by `/` and `/saved`; see the
 * task's own "shared component caution"). Structured as several
 * non-nested links to the same document (the visual/type area and the
 * title) plus an explicit "View" action and a real, separate Bookmark
 * toggle — never a button nested inside a link.
 */
export default async function SearchResultCard({ doc, uploader, isAuthenticated, bookmarked }: SearchResultCardProps) {
  const [tDocumentType, tSearch, format] = await Promise.all([
    getTranslations("documentType"),
    getTranslations("search"),
    getFormatter(),
  ]);

  const Icon = fileTypeIcon(doc);
  const detailHref = `/documents/${doc.id}`;
  const taxonomyLabel = [doc.grade?.name, doc.subjectRef ? doc.subjectRef.name : doc.subject]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card className="flex h-full flex-col overflow-hidden p-0 transition-all hover:-translate-y-px hover:border-ink/20 hover:shadow-[0_6px_16px_rgba(28,25,23,0.07)]">
      <Link href={detailHref} className="block outline-none focus-visible:ring-2 focus-visible:ring-accent">
        <div aria-hidden className="flex h-32 items-center justify-center bg-surface sm:h-36">
          <Icon className="h-10 w-10 text-secondary-strong" aria-hidden />
        </div>
      </Link>

      <div className="flex min-w-0 flex-1 flex-col p-4">
        <Badge variant="secondary" className="w-fit">
          {tDocumentType(documentTypeMessageKey(doc.documentType))}
        </Badge>

        <Link href={detailHref} className="mt-2 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <h3 className="line-clamp-2 font-display text-base font-medium leading-snug text-ink">{doc.title}</h3>
        </Link>

        {uploader ? (
          <span className="mt-1 inline-flex min-w-0 items-center gap-1 text-xs text-muted">
            <User className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{uploader.name}</span>
          </span>
        ) : null}

        {taxonomyLabel ? <p className="mt-1 truncate text-xs text-muted">{taxonomyLabel}</p> : null}

        <div className="mt-2 flex items-center gap-1 text-xs text-muted">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {format.dateTime(new Date(doc.createdAt), "dateTimeShort")}
        </div>

        <div className="mt-auto flex gap-2 pt-3">
          <Link
            href={detailHref}
            className="flex flex-1 items-center justify-center rounded-lg bg-accent px-3 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent-strong"
          >
            {tSearch("viewDocument")}
          </Link>
          <BookmarkAction documentId={doc.id} isAuthenticated={isAuthenticated} initialBookmarked={bookmarked} compact />
        </div>
      </div>
    </Card>
  );
}
