import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { AdminReportActions } from "@/components/admin/AdminReportActions";
import { ModerationStatusBadge } from "@/components/moderation/ModerationStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getAdminReportById } from "@/lib/admin/reports";
import { requireRole } from "@/lib/auth/authorize";
import { reportReasonMessageKey } from "@/lib/documents/report-reason";

type AdminReportDetailPageProps = { params: Promise<{ reportId: string }> };

export default async function AdminReportDetailPage({ params }: AdminReportDetailPageProps) {
  await requireRole("ADMIN");
  const { reportId } = await params;

  const report = await getAdminReportById(reportId);
  if (!report) notFound();

  const [tDetail, tStatus, tReasons, format] = await Promise.all([
    getTranslations("admin.reports.detail"),
    getTranslations("admin.reports.status"),
    getTranslations("report.reasons"),
    getFormatter(),
  ]);
  const reasonLabel = tReasons(reportReasonMessageKey(report.reason));

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin/reports" className="text-sm text-muted underline underline-offset-2 hover:text-ink">
        {tDetail("backToReports")}
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">{reasonLabel}</h1>
          <Badge
            variant={report.status === "OPEN" ? "warning" : report.status === "RESOLVED" ? "success" : "outline"}
            className="mt-2"
          >
            {tStatus(report.status.toLowerCase() as "open" | "resolved" | "dismissed")}
          </Badge>
        </div>
        {report.status === "OPEN" ? (
          <AdminReportActions reportId={report.id} documentTitle={report.document.title} reasonLabel={reasonLabel} />
        ) : null}
      </div>

      {report.description ? (
        <Card className="mt-6 p-4">
          <h2 className="font-display text-base font-semibold tracking-tight text-ink">{tDetail("description")}</h2>
          <p className="mt-2 text-sm text-ink">{report.description}</p>
        </Card>
      ) : null}

      <Card className="mt-4 p-4">
        <h2 className="font-display text-base font-semibold tracking-tight text-ink">{tDetail("documentSection")}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link href={`/admin/documents/${report.document.id}`} className="font-medium text-accent hover:text-accent-strong">
            {report.document.title}
          </Link>
          <ModerationStatusBadge status={report.document.moderationStatus} />
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <Link href={`/documents/${report.document.id}`} className="text-accent hover:text-accent-strong">
            {tDetail("viewPublicDetail")}
          </Link>
          <Link href={`/admin/documents/${report.document.id}`} className="text-accent hover:text-accent-strong">
            {tDetail("manageDocument")}
          </Link>
          {report.document.moderationStatus === "PENDING" ? (
            <Link href={`/moderation/${report.document.id}`} className="text-accent hover:text-accent-strong">
              {tDetail("reviewInModeration")}
            </Link>
          ) : null}
        </div>
      </Card>

      <Card className="mt-4 p-4">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-muted">{tDetail("reporter")}</dt>
            <dd className="mt-1 font-medium text-ink">{report.user.name}</dd>
            <dd className="text-xs text-muted">{report.user.email}</dd>
          </div>
          <div>
            <dt className="text-muted">{tDetail("createdAt")}</dt>
            <dd className="mt-1 font-medium text-ink">{format.dateTime(report.createdAt, "dateTimeShort")}</dd>
          </div>
          {report.status !== "OPEN" ? (
            <>
              <div>
                <dt className="text-muted">{tDetail("handledBy")}</dt>
                <dd className="mt-1 font-medium text-ink">{report.resolvedByEmail ?? tDetail("unknownHandler")}</dd>
              </div>
              <div>
                <dt className="text-muted">{tDetail("handledAt")}</dt>
                <dd className="mt-1 font-medium text-ink">
                  {report.resolvedAt ? format.dateTime(report.resolvedAt, "dateTimeShort") : "—"}
                </dd>
              </div>
            </>
          ) : null}
        </dl>
      </Card>
    </div>
  );
}
