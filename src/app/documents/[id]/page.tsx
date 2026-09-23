import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  PlayCircle,
  Presentation,
} from "lucide-react";
import type { DateTimeFormatter } from "@/i18n/formats";
import { auth } from "@/auth";
import { BookmarkAction } from "@/components/BookmarkAction";
import { CommentSection } from "@/components/CommentSection";
import { DocumentRatingSection } from "@/components/DocumentRatingSection";
import { DownloadButton } from "@/components/DownloadButton";
import { FilePreview } from "@/components/FilePreview";
import { LessonFollowAction } from "@/components/LessonFollowAction";
import { ReportDocumentAction } from "@/components/ReportDocumentAction";
import { ModerationStatusBadge } from "@/components/moderation/ModerationStatusBadge";
import { ResubmitAction } from "@/components/teacher-uploads/ResubmitAction";
import { TeacherFollowAction } from "@/components/TeacherFollowAction";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { isBookmarked } from "@/lib/documents/bookmark";
import { listComments } from "@/lib/documents/comment";
import { documentTypeMessageKey } from "@/lib/documents/document-type";
import { getDocumentById } from "@/lib/documents/get-document";
import { getRatingSummary } from "@/lib/documents/rating";
import { subjectAccent } from "@/lib/documents/subject-accent";
import { getRejectionReasonForViewer } from "@/lib/documents/teacher-uploads";
import { isDocumentVisibleTo } from "@/lib/documents/visibility";
import { MODERATION_STATUS_COLOR } from "@/lib/moderation/moderation-status-style";
import { isFollowingLesson } from "@/lib/follow/lesson-follow";
import { isFollowingTeacher } from "@/lib/follow/teacher-follow";
import { cn } from "@/lib/utils";
import type { DocumentCommentRecord } from "@/types/comment";
import type { DocumentRecord } from "@/types/document";

type DocumentDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
};

/**
 * The document detail page is a shared destination linked from many
 * places (search, saved, following, notifications, homepage, ...) — the
 * back link defaults to /search for all of those, unchanged. `?from=` is
 * an explicit, server-driven hint (not browser history/referrer, which
 * isn't available in a Server Component and isn't reliable anyway) that a
 * specific known source page sets on its own links back to itself. Only
 * "my-uploads" exists today — add another entry here (and the matching
 * `?from=` on that page's own links) if another source page needs its own
 * back destination.
 */
const BACK_DESTINATION_HREFS: Record<string, string> = {
  "my-uploads": "/my-uploads",
};
const DEFAULT_BACK_DESTINATION_HREF = "/search";

function formatDate(value: string, format: DateTimeFormatter): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return format.dateTime(date, "dateOnly");
}

/** UI-7B: same rounding as the existing formatter duplicated in my-uploads/moderation pages (no shared export exists to reuse instead). */
function formatFileSize(bytes: number | null): string | null {
  if (bytes === null) return null;
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** UI-7B: real source/file type only, same mapping as SearchResultCard's local helper (duplicated rather than shared — a page-local presentational helper, same precedent as formatFileSize above). */
function fileTypeIcon(doc: Pick<DocumentRecord, "sourceType" | "fileCategory">) {
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

/** Builds a `/search` href from real taxonomy ids only — never a hand-typed/hardcoded id. */
function taxonomyHref(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  return `/search?${search.toString()}`;
}

export default async function DocumentDetailPage({ params, searchParams }: DocumentDetailPageProps) {
  const { id } = await params;
  const { from } = await searchParams;
  const [doc, session] = await Promise.all([getDocumentById(id), auth()]);
  const [tDocumentType, tDocuments, tCommon, tModeration, tRoles, tUpload, format] = await Promise.all([
    getTranslations("documentType"),
    getTranslations("documents"),
    getTranslations("common"),
    getTranslations("moderation"),
    getTranslations("common.roles"),
    getTranslations("upload"),
    getFormatter(),
  ]);

  if (!doc) notFound();
  if (!isDocumentVisibleTo(doc, session)) notFound();

  const backDestinationHref = (from && BACK_DESTINATION_HREFS[from]) || DEFAULT_BACK_DESTINATION_HREF;
  const backDestinationLabel = from && BACK_DESTINATION_HREFS[from] ? tDocuments("backToMyUploads") : tDocuments("backToSearch");

  const currentUserId = session?.user?.id ?? null;
  const isAuthenticated = Boolean(session?.user);
  const isUploaderTeacher = doc.uploadedBy?.role === "TEACHER";

  // FEAT-10C: only the uploader or an ADMIN ever sees moderation internals
  // on this otherwise-public page — matches isDocumentVisibleTo's own
  // owner-or-admin boundary, so this can never diverge from "can this
  // person even see the document" for a non-APPROVED document.
  const isOwner = currentUserId !== null && currentUserId === doc.uploadedById;
  const isAdmin = session?.user?.role === "ADMIN";
  const canSeeModerationDetail = isOwner || isAdmin;

  const [ratingSummary, commentsPage, bookmarked, teacherFollowing, lessonFollowing, rejectionReason] =
    await Promise.all([
      getRatingSummary(doc.id, currentUserId),
      listComments(doc.id, 1),
      isBookmarked(doc.id, currentUserId),
      isUploaderTeacher && doc.uploadedBy ? isFollowingTeacher(currentUserId, doc.uploadedBy.id) : Promise.resolve(false),
      doc.lessonId ? isFollowingLesson(currentUserId, doc.lessonId) : Promise.resolve(false),
      canSeeModerationDetail && doc.moderationStatus === "REJECTED"
        ? getRejectionReasonForViewer(doc.id)
        : Promise.resolve(null),
    ]);

  const createdLabel = formatDate(doc.createdAt, format);
  const documentPagePath = `/documents/${doc.id}`;
  const initialComments: DocumentCommentRecord[] = commentsPage.comments.map((comment) => ({
    ...comment,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  }));

  // Taxonomy breadcrumb — only real, existing ids/names, never fabricated.
  // A Lesson link must carry gradeId+subjectId too, since /search only
  // honors lessonId alongside a resolved subjectId (see
  // resolveSearchTaxonomyFilters). Legacy documents (no structured
  // taxonomy) fall back to the free-text subject, linked the same way
  // SubjectCard already does on the Homepage.
  const breadcrumb: { label: string; href: string }[] = [];
  if (doc.grade) {
    breadcrumb.push({ label: doc.grade.name, href: taxonomyHref({ gradeId: doc.grade.id }) });
  }
  if (doc.subjectRef) {
    breadcrumb.push({
      label: doc.subjectRef.name,
      href: taxonomyHref({ gradeId: doc.grade?.id, subjectId: doc.subjectRef.id }),
    });
  } else if (!doc.grade) {
    breadcrumb.push({ label: doc.subject, href: `/search?subject=${encodeURIComponent(doc.subject)}` });
  }
  if (doc.lesson && doc.subjectRef) {
    breadcrumb.push({
      label: doc.lesson.name,
      href: taxonomyHref({ gradeId: doc.grade?.id, subjectId: doc.subjectRef.id, lessonId: doc.lesson.id }),
    });
  }

  // UI-7B: real metadata only for the info grid — nullable taxonomy is
  // simply omitted (never a fake/placeholder row), and YOUTUBE documents
  // never get a fabricated file size/filename (see FilePreview's own
  // sourceType-aware precedent).
  const infoItems: { label: string; value: string }[] = [];
  if (doc.grade) infoItems.push({ label: tCommon("grade"), value: doc.grade.name });
  infoItems.push({ label: tCommon("subject"), value: doc.subjectRef?.name ?? doc.subject });
  if (doc.lesson) infoItems.push({ label: tCommon("lessonTopic"), value: doc.lesson.name });
  infoItems.push({
    label: tCommon("documentType"),
    value: tDocumentType(documentTypeMessageKey(doc.documentType)),
  });
  if (doc.sourceType === "YOUTUBE") {
    infoItems.push({ label: tDocuments("fileType"), value: "YouTube" });
  } else if (doc.sourceType === "GOOGLE_FORM") {
    infoItems.push({ label: tDocuments("fileType"), value: tUpload("googleForm") });
  } else if (doc.fileCategory) {
    infoItems.push({ label: tDocuments("fileType"), value: doc.fileCategory });
  }
  if (doc.sourceType === "FILE") {
    const fileSize = formatFileSize(doc.fileSize);
    if (fileSize) infoItems.push({ label: tModeration("fileSize"), value: fileSize });
    if (doc.fileName) infoItems.push({ label: tModeration("file"), value: doc.fileName });
  }

  const HeaderIcon = fileTypeIcon(doc);
  const accentColor = subjectAccent(doc.subject);

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:py-10">
      <Link
        href={backDestinationHref}
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {backDestinationLabel}
      </Link>

      {breadcrumb.length > 0 ? (
        <nav aria-label={tDocuments("breadcrumb")} className="mt-4">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-muted">
            {breadcrumb.map((item, index) => (
              <li key={item.href} className="flex items-center gap-1">
                {index > 0 ? <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
                <Link
                  href={item.href}
                  className={cn(
                    "transition-colors hover:text-ink hover:underline",
                    index === breadcrumb.length - 1 && "font-medium text-ink"
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      {doc.lesson ? (
        <div className="mt-2">
          <LessonFollowAction
            lessonId={doc.lesson.id}
            isAuthenticated={isAuthenticated}
            initialFollowing={lessonFollowing}
            callbackPath={documentPagePath}
          />
        </div>
      ) : null}

      {/* Document identity/header */}
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start">
        <div
          aria-hidden
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-surface sm:h-20 sm:w-20"
        >
          <HeaderIcon className="h-8 w-8 sm:h-10 sm:w-10" style={{ color: accentColor }} aria-hidden />
        </div>

        <div className="min-w-0 flex-1">
          <Badge variant="soft">{tDocumentType(documentTypeMessageKey(doc.documentType))}</Badge>

          <h1 className="mt-2 font-display text-2xl font-semibold leading-tight tracking-tight text-ink sm:text-3xl">
            {doc.title}
          </h1>

          {doc.uploadedBy ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span
                aria-hidden
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-strong"
              >
                {doc.uploadedBy.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="text-sm font-medium text-ink">{doc.uploadedBy.name}</span>
              <span className="text-xs text-muted">
                ({tRoles(doc.uploadedBy.role.toLowerCase() as "student" | "teacher" | "admin")})
              </span>
              {isUploaderTeacher ? (
                <TeacherFollowAction
                  teacherId={doc.uploadedBy.id}
                  isAuthenticated={isAuthenticated}
                  isSelf={currentUserId === doc.uploadedBy.id}
                  initialFollowing={teacherFollowing}
                  callbackPath={documentPagePath}
                />
              ) : null}
            </div>
          ) : null}

          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
              {doc.academicYear}
              {createdLabel ? ` · ${tDocuments("addedOn", { date: createdLabel })}` : ""}
            </span>
          </div>
        </div>
      </div>

      {/* FEAT-10C: owner/ADMIN-only — never shown to an unrelated visitor.
          rejectionReason only ever populated above when
          canSeeModerationDetail was already true (see the Promise.all
          guard), so no extra check is needed here. */}
      {canSeeModerationDetail ? (
        <Card
          className="mt-6 flex gap-3 p-4"
          style={{ backgroundColor: `${MODERATION_STATUS_COLOR[doc.moderationStatus]}0d` }}
        >
          <span
            aria-hidden
            className="w-1 shrink-0 self-stretch rounded-full"
            style={{ backgroundColor: MODERATION_STATUS_COLOR[doc.moderationStatus] }}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-sm font-semibold tracking-tight text-ink">{tDocuments("moderationStatus")}</h2>
              <ModerationStatusBadge status={doc.moderationStatus} />
            </div>

            {doc.moderationStatus === "PENDING" ? (
              <p className="mt-2 text-sm text-muted">{tDocuments("notPublicYet")}</p>
            ) : null}

            {doc.moderationStatus === "APPROVED" ? (
              <p className="mt-2 text-sm text-muted">{tDocuments("publiclyAvailable")}</p>
            ) : null}

            {doc.moderationStatus === "REJECTED" ? (
              <>
                {rejectionReason ? (
                  <div className="mt-3 rounded-lg border border-destructive-soft bg-destructive-soft p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-destructive">{tModeration("reasonLabel")}</p>
                    <p className="mt-1 text-sm text-ink">{rejectionReason}</p>
                  </div>
                ) : null}
                {isOwner ? (
                  <div className="mt-3">
                    <ResubmitAction documentId={doc.id} />
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </Card>
      ) : null}

      {/* Preview */}
      <div className="mt-8">
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink">{tCommon("preview")}</h2>
        <div className="mt-3">
          <FilePreview
            documentId={doc.id}
            fileCategory={doc.fileCategory}
            mimeType={doc.mimeType}
            fileName={doc.fileName}
            sourceType={doc.sourceType}
            externalVideoId={doc.externalVideoId}
            sourceUrl={doc.sourceUrl}
          />
        </div>
      </div>

      {/* Description */}
      {doc.description ? (
        <div className="mt-8 rounded-xl border border-line bg-surface p-5 sm:p-6">
          <h2 className="font-display text-base font-semibold tracking-tight text-ink">{tUpload("description")}</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink/80 sm:text-base">{doc.description}</p>
        </div>
      ) : null}

      {/* Primary/secondary actions */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {/* FEAT-12B: a YouTube document has no downloadable file at all — no
            Download control is rendered for it, rather than a disabled
            button (the "Open on YouTube" action already lives in the
            preview card above). */}
        {doc.sourceType === "FILE" ? (
          <div className="sm:flex-1">
            <DownloadButton
              documentId={doc.id}
              hasFile={Boolean(doc.fileName)}
              isAuthenticated={isAuthenticated}
              className="w-full"
            />
          </div>
        ) : null}
        <div className="sm:flex-1">
          <BookmarkAction documentId={doc.id} isAuthenticated={isAuthenticated} initialBookmarked={bookmarked} />
        </div>
      </div>
      <div className="mt-3">
        <ReportDocumentAction documentId={doc.id} isAuthenticated={isAuthenticated} />
      </div>

      {/* Document information grid */}
      <div className="mt-8">
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink">{tDocuments("information")}</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {infoItems.map((item) => (
            <div key={item.label} className="rounded-xl border border-line bg-surface p-3">
              <p className="truncate text-xs text-muted">{item.label}</p>
              <p className="mt-1 truncate text-sm font-medium text-ink" title={item.value}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10 border-t border-line pt-8">
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink">{tDocuments("rating")}</h2>
        <div className="mt-3">
          <DocumentRatingSection
            documentId={doc.id}
            isAuthenticated={isAuthenticated}
            initialSummary={ratingSummary}
          />
        </div>
      </div>

      <div className="mt-10 border-t border-line pt-8">
        <CommentSection
          documentId={doc.id}
          isAuthenticated={isAuthenticated}
          currentUserId={currentUserId}
          isAdmin={session?.user?.role === "ADMIN"}
          initialComments={initialComments}
          initialTotal={commentsPage.total}
          initialTotalPages={commentsPage.totalPages}
        />
      </div>
    </div>
  );
}
