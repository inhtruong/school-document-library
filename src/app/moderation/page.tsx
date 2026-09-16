import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { CalendarDays, User } from "lucide-react";
import type { DocumentModerationStatus } from "@prisma/client";
import { ModerationStatusBadge } from "@/components/moderation/ModerationStatusBadge";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import type { DateTimeFormatter } from "@/i18n/formats";
import { requireRole } from "@/lib/auth/authorize";
import { listModerationDocuments } from "@/lib/moderation/moderation";
import { MODERATION_STATUS_COLOR } from "@/lib/moderation/moderation-status-style";
import { cn } from "@/lib/utils";

type ModerationPageProps = {
  searchParams: Promise<{ status?: string; page?: string }>;
};

const STATUS_VALUES: DocumentModerationStatus[] = ["PENDING", "APPROVED", "REJECTED"];
const STATUS_MESSAGE_KEY: Record<DocumentModerationStatus, "pending" | "approved" | "rejected"> = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
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

function formatDate(iso: string, format: DateTimeFormatter): string {
  return format.dateTime(new Date(iso), "dateTimeShort");
}

export default async function ModerationPage({ searchParams }: ModerationPageProps) {
  await requireRole("ADMIN");

  const { status: rawStatus, page: rawPage } = await searchParams;
  const status = parseStatus(rawStatus);
  const page = parsePage(rawPage);

  const result = await listModerationDocuments(status, page);
  const [tModeration, tCommon, format] = await Promise.all([
    getTranslations("moderation"),
    getTranslations("common"),
    getFormatter(),
  ]);
  const EMPTY_MESSAGES: Record<DocumentModerationStatus, string> = {
    PENDING: tModeration("emptyPending"),
    APPROVED: tModeration("emptyApproved"),
    REJECTED: tModeration("emptyRejected"),
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:py-10">
      <h1 className="font-display text-2xl font-semibold tracking-tight">{tModeration("heading")}</h1>
      <p className="mt-1 text-sm text-muted">{tModeration("subtitle")}</p>

      <nav aria-label={tModeration("statusNav")} className="mt-6 flex flex-wrap gap-2">
        {STATUS_VALUES.map((s) => (
          <Link
            key={s}
            href={tabHref(s)}
            aria-current={s === status ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              s === status ? "border-accent bg-accent text-paper" : "border-line text-ink hover:border-ink/25"
            }`}
          >
            <span
              aria-hidden
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: s === status ? "currentColor" : MODERATION_STATUS_COLOR[s] }}
            />
            {tModeration(`status.${STATUS_MESSAGE_KEY[s]}`)}
          </Link>
        ))}
      </nav>

      <p className="mt-4 text-sm text-muted">{tCommon("documentCount", { count: result.total })}</p>

      {result.documents.length > 0 ? (
        <>
          <ul className="mt-4 flex flex-col gap-3">
            {result.documents.map((doc) => {
              const taxonomy = [doc.grade?.name, doc.subjectRef?.name, doc.lesson?.name].filter(Boolean).join(" · ");
              const fileSize = formatFileSize(doc.fileSize);
              const timestampLabel =
                status === "PENDING" || !doc.reviewedAt
                  ? tModeration("uploadedOn", { date: formatDate(doc.createdAt, format) })
                  : tModeration("reviewedOn", { date: formatDate(doc.reviewedAt, format) });

              return (
                <li key={doc.id}>
                  <Card className="flex gap-3 p-4 transition-all hover:-translate-y-px hover:border-ink/20 hover:shadow-[0_4px_12px_rgba(28,25,23,0.06)] sm:items-center">
                    <span
                      aria-hidden
                      className="w-1 shrink-0 self-stretch rounded-full"
                      style={{ backgroundColor: MODERATION_STATUS_COLOR[doc.moderationStatus] }}
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium text-ink">{doc.title}</p>
                          <ModerationStatusBadge status={doc.moderationStatus} />
                        </div>
                        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                          <span className="inline-flex min-w-0 items-center gap-1">
                            <User className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            <span className="truncate">
                              {doc.uploadedBy
                                ? `${doc.uploadedBy.name} (${doc.uploadedBy.role})`
                                : tModeration("unknownUploader")}
                            </span>
                          </span>
                          {taxonomy ? <span className="truncate">{taxonomy}</span> : null}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                          {[doc.fileCategory, fileSize].filter(Boolean).length > 0 ? (
                            <span>{[doc.fileCategory, fileSize].filter(Boolean).join(" · ")}</span>
                          ) : null}
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                            {timestampLabel}
                          </span>
                        </p>
                      </div>
                      <Link href={`/moderation/${doc.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}>
                        {tModeration("review")}
                      </Link>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>

          {result.totalPages > 1 ? (
            <nav aria-label={tCommon("pagination")} className="mt-8 flex flex-wrap items-center justify-center gap-2">
              <Link
                href={pageHref(status, page - 1)}
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
                {tCommon("next")}
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
