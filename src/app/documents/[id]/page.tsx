import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { BookmarkAction } from "@/components/BookmarkAction";
import { CommentSection } from "@/components/CommentSection";
import { DocumentRatingSection } from "@/components/DocumentRatingSection";
import { DownloadButton } from "@/components/DownloadButton";
import { FilePreview } from "@/components/FilePreview";
import { ReportDocumentAction } from "@/components/ReportDocumentAction";
import { Badge } from "@/components/ui/badge";
import { fetchComments, fetchDocumentById } from "@/lib/api-client";
import { isBookmarked } from "@/lib/documents/bookmark";
import { DOCUMENT_TYPE_LABELS } from "@/lib/documents/document-type";
import { getRatingSummary } from "@/lib/documents/rating";
import { subjectAccent } from "@/lib/documents/subject-accent";

type DocumentDetailPageProps = {
  params: Promise<{ id: string }>;
};

function formatDate(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const CATEGORY_LABELS: Record<string, string> = {
  PDF: "PDF",
  WORD: "Word document",
  EXCEL: "Excel spreadsheet",
  IMAGE: "Image",
  VIDEO: "Video",
};

export default async function DocumentDetailPage({ params }: DocumentDetailPageProps) {
  const { id } = await params;
  const [doc, session] = await Promise.all([fetchDocumentById(id), auth()]);

  if (!doc) notFound();

  const [ratingSummary, commentsPage, bookmarked] = await Promise.all([
    getRatingSummary(doc.id, session?.user?.id ?? null),
    fetchComments(doc.id),
    isBookmarked(doc.id, session?.user?.id ?? null),
  ]);
  const createdLabel = formatDate(doc.createdAt);

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:py-10">
      <Link href="/search" className="text-sm text-muted transition-colors hover:text-ink">
        ← Back to search
      </Link>

      <div className="mt-6 flex gap-4">
        <span
          aria-hidden
          className="w-1 shrink-0 self-stretch rounded-full"
          style={{ backgroundColor: subjectAccent(doc.subject) }}
        />

        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
            {doc.title}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {doc.grade ? <Badge variant="soft">{doc.grade.name}</Badge> : null}
            <span className="text-sm text-ink">{doc.subjectRef ? doc.subjectRef.name : doc.subject}</span>
            {doc.lesson ? <span className="text-sm text-muted">· {doc.lesson.name}</span> : null}
            <Badge>{DOCUMENT_TYPE_LABELS[doc.documentType]}</Badge>
            <span className="text-sm text-muted">{doc.academicYear}</span>
          </div>

          {createdLabel ? <p className="mt-2 text-xs text-muted">Added {createdLabel}</p> : null}

          <div className="mt-3 flex flex-wrap items-center gap-4">
            <DocumentRatingSection
              documentId={doc.id}
              isAuthenticated={Boolean(session?.user)}
              initialSummary={ratingSummary}
            />
            <BookmarkAction
              documentId={doc.id}
              isAuthenticated={Boolean(session?.user)}
              initialBookmarked={bookmarked}
            />
          </div>
        </div>
      </div>

      {doc.description ? (
        <p className="mt-6 text-sm leading-relaxed text-ink/80 sm:text-base">{doc.description}</p>
      ) : null}

      {doc.fileName ? (
        <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm text-muted">
          <dt>File</dt>
          <dd className="text-ink">
            {doc.fileName}
            {doc.fileSize ? ` (${formatFileSize(doc.fileSize)})` : ""}
          </dd>
          {doc.fileCategory ? (
            <>
              <dt>Type</dt>
              <dd className="text-ink">{CATEGORY_LABELS[doc.fileCategory] ?? doc.fileCategory}</dd>
            </>
          ) : null}
          {doc.uploadedBy ? (
            <>
              <dt>Uploaded by</dt>
              <dd className="text-ink">{doc.uploadedBy.name}</dd>
            </>
          ) : null}
        </dl>
      ) : null}

      <div className="mt-8">
        <FilePreview
          documentId={doc.id}
          fileCategory={doc.fileCategory}
          mimeType={doc.mimeType}
          fileName={doc.fileName}
        />
      </div>

      <div className="mt-6">
        <DownloadButton
          documentId={doc.id}
          hasFile={Boolean(doc.fileName)}
          isAuthenticated={Boolean(session?.user)}
        />
      </div>

      <div className="mt-3">
        <ReportDocumentAction documentId={doc.id} isAuthenticated={Boolean(session?.user)} />
      </div>

      <div className="mt-10 border-t border-line pt-8">
        <CommentSection
          documentId={doc.id}
          isAuthenticated={Boolean(session?.user)}
          currentUserId={session?.user?.id ?? null}
          isAdmin={session?.user?.role === "ADMIN"}
          initialComments={commentsPage.comments}
          initialTotal={commentsPage.total}
          initialTotalPages={commentsPage.totalPages}
        />
      </div>
    </div>
  );
}
