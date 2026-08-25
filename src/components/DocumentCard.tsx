import Link from "next/link";
import { CalendarDays, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DOCUMENT_TYPE_LABELS } from "@/lib/documents/document-type";
import { subjectAccent } from "@/lib/documents/subject-accent";
import type { UploaderSummary } from "@/lib/documents/document-uploaders";
import type { DocumentRecord } from "@/types/document";

type DocumentCardProps = {
  doc: DocumentRecord;
  /**
   * Optional — only passed where the caller already did ONE batched lookup
   * for the whole list (see document-uploaders.ts). Never fetched by this
   * component itself: DocumentCard stays a plain Server Component with no
   * data access of its own, so it can never turn into a per-card query.
   */
  uploader?: UploaderSummary;
};

/**
 * The whole card is ONE `<Link>` (matches the original component) — no
 * nested interactive elements inside it, so this stays valid, accessible
 * HTML while still making the entire card clickable.
 */
export default function DocumentCard({ doc, uploader }: DocumentCardProps) {
  const subjectLabel = doc.subjectRef ? doc.subjectRef.name : doc.subject;

  return (
    <Link
      href={`/documents/${doc.id}`}
      className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <Card className="flex h-full gap-3 p-4 transition-all group-hover:-translate-y-px group-hover:border-ink/20 group-hover:shadow-[0_6px_16px_rgba(18,22,31,0.07)] sm:p-5">
        <span
          aria-hidden
          className="w-1 shrink-0 self-stretch rounded-full"
          style={{ backgroundColor: subjectAccent(doc.subject) }}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <Badge variant="soft" className="shrink-0">
              {DOCUMENT_TYPE_LABELS[doc.documentType]}
            </Badge>
          </div>

          <h3 className="mt-2 line-clamp-2 font-display text-base font-medium leading-snug text-ink sm:text-lg">
            {doc.title}
          </h3>

          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-ink">
            {doc.grade ? <span>{doc.grade.name}</span> : null}
            {doc.grade ? <span aria-hidden className="text-muted">·</span> : null}
            <span>{subjectLabel}</span>
          </p>
          {doc.lesson ? <p className="mt-0.5 truncate text-sm text-muted">{doc.lesson.name}</p> : null}

          {doc.description ? (
            <p className="mt-2 line-clamp-2 text-sm text-muted">{doc.description}</p>
          ) : null}

          <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-3 text-xs text-muted">
            {uploader ? (
              <span className="inline-flex min-w-0 items-center gap-1">
                <User className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">{uploader.name}</span>
              </span>
            ) : (
              <span />
            )}
            <span className="inline-flex shrink-0 items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              {doc.academicYear}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
