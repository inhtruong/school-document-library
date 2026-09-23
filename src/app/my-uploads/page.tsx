import Link from "next/link";
import {
  CalendarDays,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Inbox,
  PlayCircle,
  Presentation,
  Upload,
} from "lucide-react";
import { ModerationStatusBadge } from "@/components/moderation/ModerationStatusBadge";
import { ResubmitAction } from "@/components/teacher-uploads/ResubmitAction";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { getFormatter, getTranslations } from "next-intl/server";
import type { DateTimeFormatter } from "@/i18n/formats";
import { documentTypeMessageKey } from "@/lib/documents/document-type";
import {
  getTeacherUploadStatusCounts,
  listTeacherUploads,
  type TeacherUploadListItem,
  type TeacherUploadStatusFilter,
} from "@/lib/documents/teacher-uploads";
import { requireRole } from "@/lib/auth/authorize";
import { MODERATION_STATUS_COLOR } from "@/lib/moderation/moderation-status-style";
import { cn } from "@/lib/utils";
import type { DocumentTypeValue } from "@/lib/documents/document-type";

type MyUploadsPageProps = {
  searchParams: Promise<{ status?: string; page?: string }>;
};

const FILTER_VALUES: TeacherUploadStatusFilter[] = ["ALL", "PENDING", "APPROVED", "REJECTED"];

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

function formatDate(iso: string, format: DateTimeFormatter): string {
  return format.dateTime(new Date(iso), "dateTimeShort");
}

/** Real source/file type only — same convention as documents/[id] and SearchResultCard's local helper (duplicated on purpose, no shared export exists — see their own comments). */
function fileTypeIcon(doc: Pick<TeacherUploadListItem, "sourceType" | "fileCategory">) {
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

export default async function MyUploadsPage({ searchParams }: MyUploadsPageProps) {
  const session = await requireRole("TEACHER");

  const { status: rawStatus, page: rawPage } = await searchParams;
  const filter = parseFilter(rawStatus);
  const page = parsePage(rawPage);

  const [result, counts] = await Promise.all([
    listTeacherUploads(session.user.id, filter, page),
    getTeacherUploadStatusCounts(session.user.id),
  ]);
  const [tDocumentType, tMyUploads, tModeration, tCommon, tUpload, format] = await Promise.all([
    getTranslations("documentType"),
    getTranslations("myUploads"),
    getTranslations("moderation"),
    getTranslations("common"),
    getTranslations("upload"),
    getFormatter(),
  ]);
  const FILTER_LABELS: Record<TeacherUploadStatusFilter, string> = {
    ALL: tMyUploads("all"),
    PENDING: tModeration("status.pending"),
    APPROVED: tModeration("status.approved"),
    REJECTED: tModeration("status.rejected"),
  };
  const EMPTY_MESSAGES: Record<TeacherUploadStatusFilter, string> = {
    ALL: tMyUploads("emptyAll"),
    PENDING: tModeration("emptyPending"),
    APPROVED: tMyUploads("emptyApproved"),
    REJECTED: tMyUploads("emptyRejected"),
  };
  const STAT_ITEMS = [
    { key: "total", label: tMyUploads("totalDocuments"), value: counts.total },
    { key: "pending", label: tModeration("status.pending"), value: counts.pending },
    { key: "approved", label: tModeration("status.approved"), value: counts.approved },
    { key: "rejected", label: tModeration("status.rejected"), value: counts.rejected },
  ];

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 sm:py-10">
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        {session.user.name ? tMyUploads("greeting", { name: session.user.name }) : tMyUploads("heading")}
      </h1>
      <p className="mt-1 text-sm text-muted">{tMyUploads("subtitle")}</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STAT_ITEMS.map((item) => (
          <div key={item.key} className="rounded-xl border border-line bg-card p-4">
            <p className="text-xs text-muted">{item.label}</p>
            <p className="mt-1.5 text-2xl font-semibold text-ink">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/upload" className={cn(buttonVariants({ size: "default" }), "gap-2")}>
          <Upload className="h-4 w-4" aria-hidden />
          {tUpload("heading")}
        </Link>

        <nav aria-label={tMyUploads("statusNav")} className="flex flex-wrap gap-2">
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
      </div>

      <p className="mt-4 text-sm text-muted">{tCommon("documentCount", { count: result.total })}</p>

      {result.documents.length > 0 ? (
        <>
          <ul className="mt-4 flex flex-col gap-2">
            {result.documents.map((doc) => {
              const taxonomy = [doc.grade?.name, doc.subjectRef?.name, doc.lesson?.name].filter(Boolean).join(" · ");
              const fileSize = formatFileSize(doc.fileSize);
              const isRejected = doc.moderationStatus === "REJECTED";
              const Icon = fileTypeIcon(doc);

              return (
                <li key={doc.id}>
                  <Card className="p-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center sm:gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
                          <Icon className="h-[18px] w-[18px] text-accent" aria-hidden />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink">{doc.title}</p>
                          <p className="truncate text-xs text-muted">
                            {taxonomy || tDocumentType(documentTypeMessageKey(doc.documentType as DocumentTypeValue))}
                          </p>
                          {doc.fileCategory || fileSize ? (
                            <p className="truncate text-xs text-muted">
                              {[doc.fileCategory, fileSize].filter(Boolean).join(" · ")}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex sm:justify-center">
                        <Badge variant="secondary">
                          {tDocumentType(documentTypeMessageKey(doc.documentType as DocumentTypeValue))}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end sm:gap-1.5">
                        <ModerationStatusBadge status={doc.moderationStatus} />
                        <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted">
                          <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                          {doc.reviewedAt
                            ? tModeration("reviewedOn", { date: formatDate(doc.reviewedAt, format) })
                            : tModeration("uploadedOn", { date: formatDate(doc.createdAt, format) })}
                        </span>
                      </div>

                      <div className="flex sm:justify-end">
                        <Link
                          href={`/documents/${doc.id}?from=my-uploads`}
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
                        >
                          {tMyUploads("view")}
                        </Link>
                      </div>
                    </div>

                    {isRejected && doc.rejectionReason ? (
                      <div className="mt-3 rounded-lg border border-destructive-soft bg-destructive-soft p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-destructive">{tModeration("reasonLabel")}</p>
                        <p className="mt-1 text-sm text-ink">{doc.rejectionReason}</p>
                      </div>
                    ) : null}

                    {isRejected ? (
                      <div className="mt-3">
                        <ResubmitAction documentId={doc.id} size="sm" />
                      </div>
                    ) : null}
                  </Card>
                </li>
              );
            })}
          </ul>

          {result.totalPages > 1 ? (
            <nav aria-label={tCommon("pagination")} className="mt-8 flex flex-wrap items-center justify-center gap-2">
              <Link
                href={pageHref(filter, page - 1)}
                aria-disabled={page <= 1}
                tabIndex={page <= 1 ? -1 : undefined}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  page <= 1 ? "pointer-events-none border-line text-muted/50" : "border-line text-ink hover:border-ink/25"
                }`}
              >
                {tCommon("previous")}
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
                {tCommon("next")}
              </Link>
            </nav>
          ) : null}
        </>
      ) : (
        <div className="mt-6 flex flex-col items-center rounded-xl border border-dashed border-line bg-surface p-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-card">
            <Inbox className="h-6 w-6 text-muted" aria-hidden />
          </span>
          <p className="mt-3 text-sm text-muted">{EMPTY_MESSAGES[filter]}</p>
          {filter === "ALL" ? (
            <Link
              href="/upload"
              className={cn(buttonVariants({ size: "default" }), "mt-5 gap-2")}
            >
              <Upload className="h-4 w-4" aria-hidden />
              {tUpload("heading")}
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
