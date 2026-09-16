import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { AlertTriangle, ClipboardList, FileText, Flag, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { auditActionMessageKey, auditEntityTypeMessageKey } from "@/lib/audit/audit-display";
import {
  getAdminDashboardData,
  type AdminDashboardData,
  type FileTypeCounts,
  type PendingAttentionItem,
  type RecentActivityItem,
} from "@/lib/admin/dashboard";
import { cn } from "@/lib/utils";

const FILE_TYPE_ORDER: (keyof FileTypeCounts)[] = ["PDF", "WORD", "EXCEL", "POWERPOINT", "IMAGE", "VIDEO", "youtube"];
const FILE_TYPE_LABEL_KEY = {
  PDF: "pdf",
  WORD: "word",
  EXCEL: "excel",
  IMAGE: "image",
  VIDEO: "video",
  POWERPOINT: "powerpoint",
  youtube: "youtube",
} as const satisfies Record<keyof FileTypeCounts, string>;

type StatCardProps = {
  icon: typeof FileText;
  label: string;
  value: number;
  /** FEAT-15E: when set, the whole card links out (e.g. Open Reports -> the filtered Admin Reports queue) instead of being a plain display tile. */
  href?: string;
};

function StatCard({ icon: Icon, label, value, href }: StatCardProps) {
  const content = (
    <Card className={cn("flex items-center gap-3 p-4", href ? "transition-colors hover:border-ink/25" : undefined)}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="font-display text-xl font-semibold tracking-tight text-ink">{value}</p>
        <p className="text-xs text-muted">{label}</p>
      </div>
    </Card>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

/**
 * FEAT-15A: the dashboard is a plain Server Component — `getAdminDashboardData()`
 * is wrapped so a genuine query failure never lets a raw Prisma error message
 * reach the global error boundary (`src/app/error.tsx` renders `error.message`
 * directly), reusing I18N-1's existing `errors.codes.unexpectedError` instead
 * of inventing a second error-display mechanism.
 */
export default async function AdminDashboardPage() {
  const [tDashboard, tFileTypes, tModeration, tAuditLog, tAuditLogActions, tAuditLogEntities, tErrors, format] =
    await Promise.all([
      getTranslations("admin.dashboard"),
      getTranslations("admin.dashboard.fileTypes"),
      getTranslations("moderation"),
      getTranslations("auditLog"),
      getTranslations("auditLog.actions"),
      getTranslations("auditLog.entities"),
      getTranslations("errors.codes"),
      getFormatter(),
    ]);

  let data: AdminDashboardData;
  try {
    data = await getAdminDashboardData();
  } catch (error) {
    console.error("Failed to load admin dashboard data", error);
    throw new Error(tErrors("unexpectedError"));
  }

  const maxFileTypeCount = Math.max(1, ...FILE_TYPE_ORDER.map((key) => data.documents.byFileType[key]));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">{tDashboard("heading")}</h1>
        <p className="mt-1 text-sm text-muted">{tDashboard("subtitle")}</p>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={FileText} label={tDashboard("totalDocuments")} value={data.documents.total} />
        <StatCard icon={ClipboardList} label={tDashboard("pendingModeration")} value={data.documents.pending} />
        <StatCard icon={Users} label={tDashboard("totalUsers")} value={data.users.total} />
        <StatCard
          icon={Flag}
          label={tDashboard("openReports")}
          value={data.openReportCount}
          href="/admin/reports?status=OPEN"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="font-display text-base font-semibold tracking-tight text-ink">{tDashboard("usersByRole")}</h2>
          <dl className="mt-3 flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted">{tDashboard("students")}</dt>
              <dd className="font-medium text-ink">{data.users.students}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted">{tDashboard("teachers")}</dt>
              <dd className="font-medium text-ink">{data.users.teachers}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted">{tDashboard("admins")}</dt>
              <dd className="font-medium text-ink">{data.users.admins}</dd>
            </div>
          </dl>
        </Card>

        <Card className="p-4">
          <h2 className="font-display text-base font-semibold tracking-tight text-ink">
            {tDashboard("documentOverview")}
          </h2>
          <dl className="mt-3 flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted">{tModeration("status.approved")}</dt>
              <dd className="font-medium text-ink">{data.documents.approved}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted">{tModeration("status.pending")}</dt>
              <dd className="font-medium text-ink">{data.documents.pending}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted">{tModeration("status.rejected")}</dt>
              <dd className="font-medium text-ink">{data.documents.rejected}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="font-display text-base font-semibold tracking-tight text-ink">{tDashboard("byFileType")}</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {FILE_TYPE_ORDER.map((key) => {
            const count = data.documents.byFileType[key];
            const widthPercent = (count / maxFileTypeCount) * 100;
            return (
              <li key={key} className="flex items-center gap-3 text-sm">
                <span className="w-20 shrink-0 text-muted">{tFileTypes(FILE_TYPE_LABEL_KEY[key])}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${widthPercent}%` }} />
                </span>
                <span className="w-8 shrink-0 text-right font-medium text-ink">{count}</span>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-semibold tracking-tight text-ink">
              {tDashboard("needsAttention")}
            </h2>
            <p className="text-xs text-muted">{tDashboard("needsAttentionSubtitle")}</p>
          </div>
          <Link href="/moderation" className="shrink-0 text-sm font-medium text-accent hover:text-accent-strong">
            {tDashboard("viewAllPending")}
          </Link>
        </div>

        {data.pendingAttention.length === 0 ? (
          <p className="mt-4 text-sm text-muted">{tDashboard("noItemsPending")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {data.pendingAttention.map((item: PendingAttentionItem) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <Link
                    href={`/moderation/${item.id}`}
                    className="block truncate text-sm font-medium text-ink hover:text-accent"
                  >
                    {item.title}
                  </Link>
                  <p className="truncate text-xs text-muted">
                    {item.uploaderName ?? tDashboard("unavailableUploader")}
                    {item.taxonomySummary ? ` · ${item.taxonomySummary}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted">
                  {format.dateTime(new Date(item.createdAt), "dateTimeShort")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold tracking-tight text-ink">
            {tDashboard("recentActivity")}
          </h2>
          <Link href="/admin/audit-log" className="shrink-0 text-sm font-medium text-accent hover:text-accent-strong">
            {tDashboard("viewAuditLog")}
          </Link>
        </div>

        {data.recentActivity.length === 0 ? (
          <p className="mt-4 text-sm text-muted">{tDashboard("noRecentActivity")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {data.recentActivity.map((entry: RecentActivityItem) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <span className="font-medium text-ink">{tAuditLogActions(auditActionMessageKey(entry.action))}</span>
                  <span className="text-muted"> · {entry.actorEmail ?? tAuditLog("system")}</span>
                  {entry.entityType ? (
                    <Badge variant="outline" className="ml-2">
                      {tAuditLogEntities(auditEntityTypeMessageKey(entry.entityType))}
                    </Badge>
                  ) : null}
                </div>
                <span className="shrink-0 text-xs text-muted">
                  {format.dateTime(new Date(entry.createdAt), "dateTimeShort")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="font-display text-base font-semibold tracking-tight text-ink">{tDashboard("quickActions")}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/moderation" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            <AlertTriangle className="h-4 w-4" aria-hidden />
            {tDashboard("reviewPendingDocuments")}
          </Link>
          <Link href="/admin/audit-log" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            <ClipboardList className="h-4 w-4" aria-hidden />
            {tDashboard("viewAuditLogAction")}
          </Link>
          <Link href="/upload" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            <FileText className="h-4 w-4" aria-hidden />
            {tDashboard("uploadDocument")}
          </Link>
          <Link href="/" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            {tDashboard("backToPublicSite")}
          </Link>
        </div>
      </Card>
    </div>
  );
}
