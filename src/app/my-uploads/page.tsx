import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { ModerationStatusBadge } from "@/components/moderation/ModerationStatusBadge";
import { ResubmitAction } from "@/components/teacher-uploads/ResubmitAction";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { DOCUMENT_TYPE_LABELS } from "@/lib/documents/document-type";
import { listTeacherUploads, type TeacherUploadStatusFilter } from "@/lib/documents/teacher-uploads";
import { requireRole } from "@/lib/auth/authorize";
import { MODERATION_STATUS_COLOR } from "@/lib/moderation/moderation-status-style";
import { cn } from "@/lib/utils";
import type { DocumentTypeValue } from "@/lib/documents/document-type";

type MyUploadsPageProps = {
  searchParams: Promise<{ status?: string; page?: string }>;
};

const FILTER_VALUES: TeacherUploadStatusFilter[] = ["ALL", "PENDING", "APPROVED", "REJECTED"];
const FILTER_LABELS: Record<TeacherUploadStatusFilter, string> = {
  ALL: "All",
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};
const EMPTY_MESSAGES: Record<TeacherUploadStatusFilter, string> = {
  ALL: "You haven't uploaded any documents yet.",
  PENDING: "No documents are waiting for review.",
  APPROVED: "No approved documents yet.",
  REJECTED: "No rejected documents.",
};

function parseFilter(value: string | undefined): TeacherUploadStatusFilter {
  return (FILTER_VALUES as string[]).includes(value ?? "") ? (value as TeacherUploadStatusFilter) : "ALL";
}

function parsePage(value: string | undefined): number {
  if (!value) return 1;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
}

function tabHref(filter: TeacherUploadStatusFilter): string {
  return filter === "ALL" ? "/my-uploads" : `/my-uploads?status=${filter}`;
}

function pageHref(filter: TeacherUploadStatusFilter, page: number): string {
  const params = new URLSearchParams();
  if (filter !== "ALL") params.set("status", filter);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/my-uploads?${query}` : "/my-uploads";
}

function formatFileSize(bytes: number | null): string | null {
  if (bytes === null) return null;
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default async function MyUploadsPage({ searchParams }: MyUploadsPageProps) {
  const session = await requireRole("TEACHER");

  const { status: rawStatus, page: rawPage } = await searchParams;
  const filter = parseFilter(rawStatus);
  const page = parsePage(rawPage);

  const result = await listTeacherUploads(session.user.id, filter, page);

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:py-10">
      <h1 className="font-display text-2xl font-semibold tracking-tight">My uploads</h1>
      <p className="mt-1 text-sm text-muted">Track the review status of documents you have uploaded.</p>

      <nav aria-label="Upload status" className="mt-6 flex flex-wrap gap-2">
        {FILTER_VALUES.map((f) => (
          <Link
            key={f}
            href={tabHref(f)}
            aria-current={f === filter ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              f === filter ? "border-accent bg-accent text-paper" : "border-line text-ink hover:border-ink/25"
            }`}
          >
            {f !== "ALL" ? (
              <span
                aria-hidden
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: f === filter ? "currentColor" : MODERATION_STATUS_COLOR[f] }}
              />
            ) : null}
            {FILTER_LABELS[f]}
          </Link>
        ))}
      </nav>

      <p className="mt-4 text-sm text-muted">
        {result.total} {result.total === 1 ? "document" : "documents"}
      </p>

      {result.documents.length > 0 ? (
        <>
          <ul className="mt-4 flex flex-col gap-3">
            {result.documents.map((doc) => {
              const taxonomy = [doc.grade?.name, doc.subjectRef?.name, doc.lesson?.name].filter(Boolean).join(" · ");
              const fileSize = formatFileSize(doc.fileSize);
              const isRejected = doc.moderationStatus === "REJECTED";

              return (
                <li key={doc.id}>
                  <Card className="flex gap-3 p-4">
                    <span
                      aria-hidden
                      className="w-1 shrink-0 self-stretch rounded-full"
                      style={{ backgroundColor: MODERATION_STATUS_COLOR[doc.moderationStatus] }}
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-medium text-ink">{doc.title}</p>
                            <ModerationStatusBadge status={doc.moderationStatus} />
                          </div>
                          <p className="mt-1 truncate text-sm text-muted">
                            {taxonomy || DOCUMENT_TYPE_LABELS[doc.documentType as DocumentTypeValue]}
                          </p>
                          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                            {[doc.fileCategory, fileSize].filter(Boolean).length > 0 ? (
                              <span>{[doc.fileCategory, fileSize].filter(Boolean).join(" · ")}</span>
                            ) : null}
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                              {doc.reviewedAt ? `Reviewed ${formatDate(doc.reviewedAt)}` : `Uploaded ${formatDate(doc.createdAt)}`}
                            </span>
                          </p>
                        </div>
                        <Link
                          href={`/documents/${doc.id}?from=my-uploads`}
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
                        >
                          View
                        </Link>
                      </div>

                      {isRejected && doc.rejectionReason ? (
                        <div className="rounded-lg border border-destructive-soft bg-destructive-soft p-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-destructive">Reason</p>
                          <p className="mt-1 text-sm text-ink">{doc.rejectionReason}</p>
                        </div>
                      ) : null}

                      {isRejected ? (
                        <div>
                          <ResubmitAction documentId={doc.id} size="sm" />
                        </div>
                      ) : null}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>

          {result.totalPages > 1 ? (
            <nav aria-label="Pagination" className="mt-8 flex flex-wrap items-center justify-center gap-2">
              <Link
                href={pageHref(filter, page - 1)}
                aria-disabled={page <= 1}
                tabIndex={page <= 1 ? -1 : undefined}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  page <= 1 ? "pointer-events-none border-line text-muted/50" : "border-line text-ink hover:border-ink/25"
                }`}
              >
                Previous
              </Link>

              {Array.from({ length: result.totalPages }, (_, index) => index + 1).map((pageNumber) => (
                <Link
                  key={pageNumber}
                  href={pageHref(filter, pageNumber)}
                  aria-current={pageNumber === page ? "page" : undefined}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                    pageNumber === page
                      ? "border-accent bg-accent text-paper"
                      : "border-line text-ink hover:border-ink/25"
                  }`}
                >
                  {pageNumber}
                </Link>
              ))}

              <Link
                href={pageHref(filter, page + 1)}
                aria-disabled={page >= result.totalPages}
                tabIndex={page >= result.totalPages ? -1 : undefined}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  page >= result.totalPages
                    ? "pointer-events-none border-line text-muted/50"
                    : "border-line text-ink hover:border-ink/25"
                }`}
              >
                Next
              </Link>
            </nav>
          ) : null}
        </>
      ) : (
        <div className="mt-6 rounded-xl border border-dashed border-line bg-surface p-8 text-center">
          <p className="text-sm text-muted">{EMPTY_MESSAGES[filter]}</p>
          {filter === "ALL" ? (
            <Link
              href="/upload"
              className="mt-5 inline-flex h-10 items-center rounded-xl bg-accent px-4 text-sm font-medium text-paper transition-colors hover:bg-accent-strong"
            >
              Upload document
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
