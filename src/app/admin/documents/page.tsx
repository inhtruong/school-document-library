import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { FileStack } from "lucide-react";
import type { DocumentModerationStatus, DocumentSourceType } from "@prisma/client";
import { AdminDocumentFilters } from "@/components/admin/AdminDocumentFilters";
import { ModerationStatusBadge } from "@/components/moderation/ModerationStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { DateTimeFormatter } from "@/i18n/formats";
import { listAdminDocuments } from "@/lib/admin/documents";
import { requireRole } from "@/lib/auth/authorize";
import { documentTypeMessageKey, DOCUMENT_TYPE_VALUES, type DocumentTypeValue } from "@/lib/documents/document-type";
import { listGrades } from "@/lib/documents/grades";

type AdminDocumentsPageProps = {
  searchParams: Promise<{
    search?: string;
    status?: string;
    sourceType?: string;
    documentType?: string;
    gradeId?: string;
    subjectId?: string;
    lessonId?: string;
    page?: string;
  }>;
};

const STATUS_VALUES: DocumentModerationStatus[] = ["PENDING", "APPROVED", "REJECTED"];
const SOURCE_TYPE_VALUES: DocumentSourceType[] = ["FILE", "YOUTUBE"];

function parseStatus(value: string | undefined): DocumentModerationStatus | undefined {
  return value && (STATUS_VALUES as string[]).includes(value) ? (value as DocumentModerationStatus) : undefined;
}

function parseSourceType(value: string | undefined): DocumentSourceType | undefined {
  return value && (SOURCE_TYPE_VALUES as string[]).includes(value) ? (value as DocumentSourceType) : undefined;
}

function parseDocumentType(value: string | undefined): DocumentTypeValue | undefined {
  return value && (DOCUMENT_TYPE_VALUES as readonly string[]).includes(value) ? (value as DocumentTypeValue) : undefined;
}

function parsePage(value: string | undefined): number {
  if (!value) return 1;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
}

function pageHref(
  filter: Record<string, string | undefined>,
  page: number
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filter)) {
    if (value) params.set(key, value);
  }
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/documents?${query}` : "/admin/documents";
}

function formatDate(date: Date, format: DateTimeFormatter): string {
  return format.dateTime(date, "dateTimeShort");
}

export default async function AdminDocumentsPage({ searchParams }: AdminDocumentsPageProps) {
  await requireRole("ADMIN");

  const raw = await searchParams;
  const search = raw.search?.trim() || undefined;
  const status = parseStatus(raw.status);
  const sourceType = parseSourceType(raw.sourceType);
  const documentType = parseDocumentType(raw.documentType);
  const page = parsePage(raw.page);
  const filter = {
    search: raw.search,
    status: raw.status,
    sourceType: raw.sourceType,
    documentType: raw.documentType,
    gradeId: raw.gradeId,
    subjectId: raw.subjectId,
    lessonId: raw.lessonId,
  };

  const [result, grades, tDocuments, tDocumentType, tCommon] = await Promise.all([
    listAdminDocuments(
      { search, status, sourceType, documentType, gradeId: raw.gradeId, subjectId: raw.subjectId, lessonId: raw.lessonId },
      page
    ),
    listGrades(),
    getTranslations("admin.documents"),
    getTranslations("documentType"),
    getTranslations("common"),
  ]);
  const format = await getFormatter();

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">{tDocuments("heading")}</h1>
      <p className="mt-1 text-sm text-muted">{tDocuments("subtitle")}</p>

      <div className="mt-6">
        <AdminDocumentFilters grades={grades} />
      </div>

      <p className="mt-4 text-sm text-muted">{tDocuments("documentCount", { count: result.total })}</p>

      {result.documents.length > 0 ? (
        <>
          <Card className="mt-4 divide-y divide-line overflow-hidden p-0">
            <ul>
              {result.documents.map((document) => {
                const taxonomySummary = document.lesson
                  ? `${document.grade?.name} · ${document.subjectRef?.name} · ${document.lesson.name}`
                  : null;
                return (
                  <li
                    key={document.id}
                    className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                  >
                    <div className="min-w-0">
                      <Link href={`/admin/documents/${document.id}`} className="font-medium text-ink hover:text-accent">
                        {document.title}
                      </Link>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {document.uploadedBy?.name ?? tDocuments("unknownUploader")}
                        {taxonomySummary ? ` · ${taxonomySummary}` : ""} ·{" "}
                        {tDocumentType(documentTypeMessageKey(document.documentType))}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Badge variant="outline">{document.sourceType === "YOUTUBE" ? tDocuments("sourceYoutube") : tDocuments("sourceFile")}</Badge>
                      <ModerationStatusBadge status={document.moderationStatus} />
                      <span className="text-xs text-muted">{formatDate(document.createdAt, format)}</span>
                    </div>
                  </li>
                );
              })}
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
              <span className="text-xs text-muted">{tCommon("pageOf", { page, total: result.totalPages })}</span>
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
          <FileStack className="h-5 w-5 text-muted" aria-hidden />
          <p className="text-sm text-muted">{tDocuments("noDocuments")}</p>
        </div>
      )}
    </div>
  );
}
