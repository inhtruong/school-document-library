import Link from "next/link";
import { notFound } from "next/navigation";
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
import { Separator } from "@/components/ui/separator";
import { isBookmarked } from "@/lib/documents/bookmark";
import { listComments } from "@/lib/documents/comment";
import { DOCUMENT_TYPE_LABELS } from "@/lib/documents/document-type";
import { getDocumentById } from "@/lib/documents/get-document";
import { getRatingSummary } from "@/lib/documents/rating";
import { subjectAccent } from "@/lib/documents/subject-accent";
import { getRejectionReasonForViewer } from "@/lib/documents/teacher-uploads";
import { isDocumentVisibleTo } from "@/lib/documents/visibility";
import { isFollowingLesson } from "@/lib/follow/lesson-follow";
import { isFollowingTeacher } from "@/lib/follow/teacher-follow";
import type { DocumentCommentRecord } from "@/types/comment";

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
const BACK_DESTINATIONS: Record<string, { href: string; label: string }> = {
  "my-uploads": { href: "/my-uploads", label: "Back to my uploads" },
};
const DEFAULT_BACK_DESTINATION = { href: "/search", label: "Back to search" };

function formatDate(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
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

  if (!doc) notFound();
  if (!isDocumentVisibleTo(doc, session)) notFound();

  const backDestination = (from && BACK_DESTINATIONS[from]) || DEFAULT_BACK_DESTINATION;

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

  const createdLabel = formatDate(doc.createdAt);
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

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 sm:py-10">
      <Link href={backDestination.href} className="text-sm text-muted transition-colors hover:text-ink">
        ← {backDestination.label}
      </Link>

      {breadcrumb.length > 0 ? (
        <nav aria-label="Breadcrumb" className="mt-3">
          <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted">
            {breadcrumb.map((item, index) => (
              <li key={item.href} className="flex items-center gap-1.5">
                {index > 0 ? <span aria-hidden>/</span> : null}
                <Link href={item.href} className="transition-colors hover:text-ink hover:underline">
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

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_280px] lg:items-start">
        {/* Main column — identity, description, preview */}
        <div className="min-w-0">
          <div className="flex gap-4">
            <span
              aria-hidden
              className="w-1 shrink-0 self-stretch rounded-full"
              style={{ backgroundColor: subjectAccent(doc.subject) }}
            />
            <div className="min-w-0 flex-1">
              <Badge variant="soft">{DOCUMENT_TYPE_LABELS[doc.documentType]}</Badge>

              <h1 className="mt-2 font-display text-2xl font-semibold leading-tight tracking-tight text-ink sm:text-3xl">
                {doc.title}
              </h1>

              <p className="mt-2 text-sm text-muted">
                {doc.academicYear}
                {createdLabel ? ` · Added ${createdLabel}` : ""}
              </p>

              {doc.description ? (
                <p className="mt-4 text-sm leading-relaxed text-ink/80 sm:text-base">{doc.description}</p>
              ) : null}
            </div>
          </div>

          {/* FEAT-10C: owner/ADMIN-only — never shown to an unrelated
              visitor. rejectionReason only ever populated above when
              canSeeModerationDetail was already true (see the Promise.all
              guard), so no extra check is needed here. */}
          {canSeeModerationDetail ? (
            <div className="mt-6 rounded-xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-sm font-semibold tracking-tight text-ink">Moderation status</h2>
                <ModerationStatusBadge status={doc.moderationStatus} />
              </div>

              {doc.moderationStatus === "PENDING" ? (
                <p className="mt-2 text-sm text-muted">This document is not public yet.</p>
              ) : null}

              {doc.moderationStatus === "APPROVED" ? (
                <p className="mt-2 text-sm text-muted">This document is publicly available.</p>
              ) : null}

              {doc.moderationStatus === "REJECTED" ? (
                <>
                  {rejectionReason ? (
                    <div className="mt-3 rounded-lg border border-destructive-soft bg-destructive-soft p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-destructive">Reason</p>
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
          ) : null}

          <div className="mt-8">
            <h2 className="font-display text-lg font-semibold tracking-tight text-ink">Preview</h2>
            <div className="mt-3">
              <FilePreview
                documentId={doc.id}
                fileCategory={doc.fileCategory}
                mimeType={doc.mimeType}
                fileName={doc.fileName}
              />
            </div>
          </div>
        </div>

        {/* Sidebar — uploader + primary actions. `lg:sticky` is CSS-only (no
            scroll listeners); `self-start` keeps it from stretching to the
            (taller) main column's height, which is what makes sticky work
            inside a grid. Falls back to normal single-column flow below
            `lg:`. */}
        <aside className="flex flex-col gap-5 lg:sticky lg:top-20 lg:self-start">
          {doc.uploadedBy ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Uploaded by</p>
              <div className="mt-2 flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent"
                >
                  {doc.uploadedBy.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{doc.uploadedBy.name}</p>
                  <p className="text-xs text-muted">{doc.uploadedBy.role}</p>
                </div>
              </div>
              {isUploaderTeacher ? (
                <div className="mt-2.5">
                  <TeacherFollowAction
                    teacherId={doc.uploadedBy.id}
                    isAuthenticated={isAuthenticated}
                    isSelf={currentUserId === doc.uploadedBy.id}
                    initialFollowing={teacherFollowing}
                    callbackPath={documentPagePath}
                  />
                </div>
              ) : null}
              <Separator className="mt-5" />
            </div>
          ) : null}

          <div className="flex flex-col gap-2.5">
            <DownloadButton
              documentId={doc.id}
              hasFile={Boolean(doc.fileName)}
              isAuthenticated={isAuthenticated}
            />
            <BookmarkAction
              documentId={doc.id}
              isAuthenticated={isAuthenticated}
              initialBookmarked={bookmarked}
            />
          </div>
        </aside>
      </div>

      <div className="mt-10 border-t border-line pt-8">
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink">Rating</h2>
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

      <div className="mt-8 border-t border-line pt-5">
        <ReportDocumentAction documentId={doc.id} isAuthenticated={isAuthenticated} />
      </div>
    </div>
  );
}
