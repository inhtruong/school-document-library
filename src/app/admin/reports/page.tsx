import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Flag } from "lucide-react";
import type { ReportStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { DateTimeFormatter } from "@/i18n/formats";
import { listAdminReports } from "@/lib/admin/reports";
import { requireRole } from "@/lib/auth/authorize";
import { REPORT_REASON_VALUES, reportReasonMessageKey, type ReportReasonValue } from "@/lib/documents/report-reason";

type AdminReportsPageProps = {
  searchParams: Promise<{ status?: string; reason?: string; search?: string; page?: string }>;
};

const STATUS_VALUES: ReportStatus[] = ["OPEN", "RESOLVED", "DISMISSED"];
const STATUS_BADGE_VARIANT: Record<ReportStatus, "warning" | "success" | "outline"> = {
  OPEN: "warning",
  RESOLVED: "success",
  DISMISSED: "outline",
};

function parseStatus(value: string | undefined): ReportStatus {
  return (STATUS_VALUES as string[]).includes(value ?? "") ? (value as ReportStatus) : "OPEN";
}

function parseReason(value: string | undefined): ReportReasonValue | undefined {
  return value && (REPORT_REASON_VALUES as readonly string[]).includes(value) ? (value as ReportReasonValue) : undefined;
}

function parsePage(value: string | undefined): number {
  if (!value) return 1;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
}

function tabHref(status: ReportStatus): string {
  return status === "OPEN" ? "/admin/reports" : `/admin/reports?status=${status}`;
}

function pageHref(filter: { status: ReportStatus; reason?: string; search?: string }, page: number): string {
  const params = new URLSearchParams();
  if (filter.status !== "OPEN") params.set("status", filter.status);
  if (filter.reason) params.set("reason", filter.reason);
  if (filter.search) params.set("search", filter.search);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/reports?${query}` : "/admin/reports";
}

function formatDate(date: Date, format: DateTimeFormatter): string {
  return format.dateTime(date, "dateTimeShort");
}

export default async function AdminReportsPage({ searchParams }: AdminReportsPageProps) {
  await requireRole("ADMIN");

  const raw = await searchParams;
  const status = parseStatus(raw.status);
  const reason = parseReason(raw.reason);
  const search = raw.search?.trim() || undefined;
  const page = parsePage(raw.page);

  const [result, tReports, tStatus, tReasons, tCommon, tActions, format] = await Promise.all([
    listAdminReports({ status, reason, search }, page),
    getTranslations("admin.reports"),
    getTranslations("admin.reports.status"),
    getTranslations("report.reasons"),
    getTranslations("common"),
    getTranslations("actions"),
    getFormatter(),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">{tReports("heading")}</h1>
      <p className="mt-1 text-sm text-muted">{tReports("subtitle")}</p>

      <nav aria-label={tReports("statusNav")} className="mt-6 flex flex-wrap gap-2">
        {STATUS_VALUES.map((value) => (
          <Link
            key={value}
            href={tabHref(value)}
            aria-current={value === status ? "page" : undefined}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              value === status ? "border-accent bg-accent text-paper" : "border-line text-ink hover:border-ink/25"
            }`}
          >
            {tStatus(value.toLowerCase() as "open" | "resolved" | "dismissed")}
          </Link>
        ))}
      </nav>

      <form method="GET" className="mt-6 flex flex-wrap items-end gap-3">
        <input type="hidden" name="status" value={status} />
        <label className="flex min-w-40 flex-1 flex-col gap-1.5 text-sm" htmlFor="report-filter-search">
          {tReports("searchLabel")}
          <input
            id="report-filter-search"
            type="text"
            name="search"
            defaultValue={search ?? ""}
            placeholder={tReports("searchPlaceholder")}
            className="h-10 rounded-lg border border-line bg-paper px-3 text-sm outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm" htmlFor="report-filter-reason">
          {tReports("reasonLabel")}
          <select
            id="report-filter-reason"
            name="reason"
            defaultValue={reason ?? ""}
            className="h-10 rounded-lg border border-line bg-paper px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <option value="">{tReports("allReasons")}</option>
            {REPORT_REASON_VALUES.map((value) => (
              <option key={value} value={value}>
                {tReasons(reportReasonMessageKey(value))}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="outline">
          {tActions("filter")}
        </Button>
      </form>

      <p className="mt-4 text-sm text-muted">{tReports("reportCount", { count: result.total })}</p>

      {result.reports.length > 0 ? (
        <>
          <Card className="mt-4 divide-y divide-line overflow-hidden p-0">
            <ul>
              {result.reports.map((report) => (
                <li
                  key={report.id}
                  className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/admin/reports/${report.id}`}
                      className="font-medium text-ink hover:text-accent"
                    >
                      {report.document.title}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {tReasons(reportReasonMessageKey(report.reason))} · {report.user.name}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={STATUS_BADGE_VARIANT[report.status]}>
                      {tStatus(report.status.toLowerCase() as "open" | "resolved" | "dismissed")}
                    </Badge>
                    <span className="text-xs text-muted">{formatDate(report.createdAt, format)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          {result.totalPages > 1 ? (
            <nav aria-label={tCommon("pagination")} className="mt-8 flex flex-wrap items-center justify-center gap-2">
              <Link
                href={pageHref({ status, reason, search }, page - 1)}
                aria-disabled={page <= 1}
                tabIndex={page <= 1 ? -1 : undefined}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  page <= 1 ? "pointer-events-none border-line text-muted/50" : "border-line text-ink hover:border-ink/25"
                }`}
              >
                {tCommon("previous")}
              </Link>
              <span className="text-xs text-muted">{tCommon("pageOf", { page, total: result.totalPages })}</span>
              <Link
                href={pageHref({ status, reason, search }, page + 1)}
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
        <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-surface p-10 text-center">
          <Flag className="h-5 w-5 text-muted" aria-hidden />
          <p className="text-sm text-muted">{tReports("noReports")}</p>
        </div>
      )}
    </div>
  );
}
