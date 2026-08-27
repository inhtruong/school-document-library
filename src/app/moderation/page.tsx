import Link from "next/link";
import type { DocumentModerationStatus } from "@prisma/client";
import { ModerationStatusBadge } from "@/components/moderation/ModerationStatusBadge";
import { requireRole } from "@/lib/auth/authorize";
import { listModerationDocuments } from "@/lib/moderation/moderation";

type ModerationPageProps = {
  searchParams: Promise<{ status?: string; page?: string }>;
};

const STATUS_VALUES: DocumentModerationStatus[] = ["PENDING", "APPROVED", "REJECTED"];
const STATUS_LABELS: Record<DocumentModerationStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};
const EMPTY_MESSAGES: Record<DocumentModerationStatus, string> = {
  PENDING: "No documents are waiting for review.",
  APPROVED: "No approved moderation records yet.",
  REJECTED: "No rejected moderation records yet.",
};

function parseStatus(value: string | undefined): DocumentModerationStatus {
  return (STATUS_VALUES as string[]).includes(value ?? "") ? (value as DocumentModerationStatus) : "PENDING";
}

function parsePage(value: string | undefined): number {
  if (!value) return 1;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
}

function tabHref(status: DocumentModerationStatus): string {
  return status === "PENDING" ? "/moderation" : `/moderation?status=${status}`;
}

function pageHref(status: DocumentModerationStatus, page: number): string {
  const params = new URLSearchParams();
  if (status !== "PENDING") params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/moderation?${query}` : "/moderation";
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

export default async function ModerationPage({ searchParams }: ModerationPageProps) {
  await requireRole("ADMIN");

  const { status: rawStatus, page: rawPage } = await searchParams;
  const status = parseStatus(rawStatus);
  const page = parsePage(rawPage);

  const result = await listModerationDocuments(status, page);

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:py-10">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Moderation</h1>
      <p className="mt-1 text-sm text-muted">Review teacher-uploaded documents before they become public.</p>

      <nav aria-label="Moderation status" className="mt-6 flex flex-wrap gap-2">
        {STATUS_VALUES.map((s) => (
          <Link
            key={s}
            href={tabHref(s)}
            aria-current={s === status ? "page" : undefined}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              s === status ? "border-accent bg-accent text-paper" : "border-line text-ink hover:border-ink/25"
            }`}
          >
            {STATUS_LABELS[s]}
          </Link>
        ))}
      </nav>

      <p className="mt-4 text-sm text-muted">
        {result.total} {result.total === 1 ? "document" : "documents"}
      </p>

      {result.documents.length > 0 ? (
        <>
          <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
            {result.documents.map((doc) => {
              const taxonomy = [doc.grade?.name, doc.subjectRef?.name, doc.lesson?.name].filter(Boolean).join(" · ");
              const fileSize = formatFileSize(doc.fileSize);
              const timestampLabel =
                status === "PENDING" || !doc.reviewedAt
                  ? `Uploaded ${formatDate(doc.createdAt)}`
                  : `Reviewed ${formatDate(doc.reviewedAt)}`;

              return (
                <li key={doc.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium text-ink">{doc.title}</p>
                      <ModerationStatusBadge status={doc.moderationStatus} />
                    </div>
                    <p className="mt-1 truncate text-sm text-muted">
                      {doc.uploadedBy ? `${doc.uploadedBy.name} (${doc.uploadedBy.role})` : "Unknown uploader"}
                      {taxonomy ? ` · ${taxonomy}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {[doc.fileCategory, fileSize].filter(Boolean).join(" · ")}
                      {doc.fileCategory || fileSize ? " · " : ""}
                      {timestampLabel}
                    </p>
                  </div>
                  <Link
                    href={`/moderation/${doc.id}`}
                    className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-center text-sm font-medium text-ink transition-colors hover:border-ink/25 hover:bg-surface"
                  >
                    Review
                  </Link>
                </li>
              );
            })}
          </ul>

          {result.totalPages > 1 ? (
            <nav aria-label="Pagination" className="mt-8 flex flex-wrap items-center justify-center gap-2">
              <Link
                href={pageHref(status, page - 1)}
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
                  href={pageHref(status, pageNumber)}
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
                href={pageHref(status, page + 1)}
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
          <p className="text-sm text-muted">{EMPTY_MESSAGES[status]}</p>
        </div>
      )}
    </div>
  );
}
