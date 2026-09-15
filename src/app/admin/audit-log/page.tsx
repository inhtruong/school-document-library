import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { FileClock } from "lucide-react";
import type { AuditAction, AuditEntityType, Prisma } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { DateTimeFormatter } from "@/i18n/formats";
import {
  AUDIT_ACTION_VALUES,
  AUDIT_ENTITY_TYPE_VALUES,
  auditActionMessageKey,
  auditEntityTypeMessageKey,
} from "@/lib/audit/audit-display";
import { listAuditLogs, type AuditLogListItem } from "@/lib/audit/audit-log-list";
import { requireRole } from "@/lib/auth/authorize";

type AuditLogPageProps = {
  searchParams: Promise<{ action?: string; entityType?: string; actorEmail?: string; page?: string }>;
};

function parseAction(value: string | undefined): AuditAction | undefined {
  return value && (AUDIT_ACTION_VALUES as string[]).includes(value) ? (value as AuditAction) : undefined;
}

function parseEntityType(value: string | undefined): AuditEntityType | undefined {
  return value && (AUDIT_ENTITY_TYPE_VALUES as string[]).includes(value) ? (value as AuditEntityType) : undefined;
}

function parsePage(value: string | undefined): number {
  if (!value) return 1;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
}

function formatDate(iso: string, format: DateTimeFormatter): string {
  return format.dateTime(new Date(iso), "dateTimeShort");
}

function pageHref(filter: { action?: string; entityType?: string; actorEmail?: string }, page: number): string {
  const params = new URLSearchParams();
  if (filter.action) params.set("action", filter.action);
  if (filter.entityType) params.set("entityType", filter.entityType);
  if (filter.actorEmail) params.set("actorEmail", filter.actorEmail);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/audit-log?${query}` : "/admin/audit-log";
}

/** Safe, typed access into an opaque `Json` metadata value — never assumes a shape beyond checking the one field it needs. */
function metadataString(metadata: Prisma.JsonValue | null, key: string): string | null {
  if (metadata !== null && typeof metadata === "object" && !Array.isArray(metadata)) {
    const value = (metadata as Record<string, unknown>)[key];
    if (typeof value === "string") return value;
  }
  return null;
}

/**
 * The one extra line under an action/actor row — a linked (or, if the
 * Document no longer exists, plain-text) title for anything Document-
 * related, or the attempted email for a failed login. Never a broken
 * mandatory link (FEAT-11 §19/§31): `linkedDocumentExists` is computed by
 * `listAuditLogs()` from a single batched query, not a per-row lookup here.
 */
function EntityLine({
  log,
  t,
}: {
  log: AuditLogListItem;
  t: (key: "deletedDocument" | "attempted", values?: Record<string, string>) => string;
}) {
  if (log.linkedDocumentId) {
    const title = metadataString(log.metadata, "documentTitle") ?? log.linkedDocumentId;
    if (log.linkedDocumentExists) {
      return (
        <Link href={`/documents/${log.linkedDocumentId}`} className="text-sm text-accent hover:text-accent-strong">
          {title}
        </Link>
      );
    }
    return <p className="text-sm text-muted">{t("deletedDocument", { title })}</p>;
  }

  if (log.action === "USER_LOGIN_FAILED") {
    const attemptedEmail = metadataString(log.metadata, "attemptedEmail");
    return attemptedEmail ? <p className="text-sm text-muted">{t("attempted", { email: attemptedEmail })}</p> : null;
  }

  return null;
}

export default async function AuditLogPage({ searchParams }: AuditLogPageProps) {
  await requireRole("ADMIN");

  const { action: rawAction, entityType: rawEntityType, actorEmail: rawActorEmail, page: rawPage } = await searchParams;
  const action = parseAction(rawAction);
  const entityType = parseEntityType(rawEntityType);
  const actorEmail = rawActorEmail?.trim() || undefined;
  const page = parsePage(rawPage);
  const filter = { action: rawAction, entityType: rawEntityType, actorEmail };

  const result = await listAuditLogs({ action, entityType, actorEmail }, page);
  const [tAuditLog, tAuditLogActions, tAuditLogEntities, tCommon, tActions, format] = await Promise.all([
    getTranslations("auditLog"),
    getTranslations("auditLog.actions"),
    getTranslations("auditLog.entities"),
    getTranslations("common"),
    getTranslations("actions"),
    getFormatter(),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-2xl font-semibold tracking-tight">{tAuditLog("heading")}</h1>
      <p className="mt-2 text-sm text-muted">{tAuditLog("subtitle")}</p>

      <form method="GET" className="mt-6 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 text-sm" htmlFor="audit-filter-action">
          {tAuditLog("action")}
          <select
            id="audit-filter-action"
            name="action"
            defaultValue={action ?? ""}
            className="h-10 rounded-lg border border-line bg-paper px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <option value="">{tAuditLog("allActions")}</option>
            {AUDIT_ACTION_VALUES.map((value) => (
              <option key={value} value={value}>
                {tAuditLogActions(auditActionMessageKey(value))}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm" htmlFor="audit-filter-entity">
          {tAuditLog("entity")}
          <select
            id="audit-filter-entity"
            name="entityType"
            defaultValue={entityType ?? ""}
            className="h-10 rounded-lg border border-line bg-paper px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <option value="">{tAuditLog("allEntities")}</option>
            {AUDIT_ENTITY_TYPE_VALUES.map((value) => (
              <option key={value} value={value}>
                {tAuditLogEntities(auditEntityTypeMessageKey(value))}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-40 flex-1 flex-col gap-1.5 text-sm" htmlFor="audit-filter-actor">
          {tAuditLog("actorEmail")}
          <input
            id="audit-filter-actor"
            type="text"
            name="actorEmail"
            defaultValue={actorEmail ?? ""}
            placeholder={tAuditLog("searchByEmail")}
            className="h-10 rounded-lg border border-line bg-paper px-3 text-sm outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
          />
        </label>

        <Button type="submit" variant="outline">
          {tActions("filter")}
        </Button>
      </form>

      <p className="mt-4 text-sm text-muted">{tAuditLog("eventCount", { count: result.total })}</p>

      {result.logs.length > 0 ? (
        <>
          <Card className="mt-4 divide-y divide-line overflow-hidden p-0">
            <ul>
              {result.logs.map((log) => (
                <li
                  key={log.id}
                  className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-ink">{tAuditLogActions(auditActionMessageKey(log.action))}</p>
                      {log.status === "FAILURE" ? <Badge variant="destructive">{tAuditLog("failed")}</Badge> : null}
                    </div>
                    <p className="mt-0.5 text-sm text-muted">
                      {log.actorEmail ?? tAuditLog("system")}
                      {log.actorRole ? ` · ${log.actorRole}` : ""}
                    </p>
                    <div className="mt-0.5">
                      <EntityLine log={log} t={tAuditLog} />
                    </div>
                  </div>
                  <p className="shrink-0 text-xs text-muted sm:text-right">{formatDate(log.createdAt, format)}</p>
                </li>
              ))}
            </ul>
          </Card>

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
              <span className="text-xs text-muted">
                {tCommon("pageOf", { page, total: result.totalPages })}
              </span>
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
        <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-surface p-10 text-center">
          <FileClock className="h-5 w-5 text-muted" aria-hidden />
          <p className="text-sm text-muted">{tAuditLog("noActivity")}</p>
        </div>
      )}
    </div>
  );
}
