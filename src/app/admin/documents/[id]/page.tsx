import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { AdminDocumentActions } from "@/components/admin/AdminDocumentActions";
import { ModerationStatusBadge } from "@/components/moderation/ModerationStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getAdminDocumentById } from "@/lib/admin/documents";
import { requireRole } from "@/lib/auth/authorize";
import { documentTypeMessageKey } from "@/lib/documents/document-type";
import { listGrades } from "@/lib/documents/grades";
import { buildYouTubeWatchUrl } from "@/lib/documents/youtube";

type AdminDocumentDetailPageProps = { params: Promise<{ id: string }> };

function formatFileSize(bytes: number | null): string | null {
  if (bytes === null) return null;
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function AdminDocumentDetailPage({ params }: AdminDocumentDetailPageProps) {
  await requireRole("ADMIN");
  const { id } = await params;

  const document = await getAdminDocumentById(id);
  if (!document) notFound();

  const [grades, tDetail, tDocumentType, format] = await Promise.all([
    listGrades(),
    getTranslations("admin.documents.detail"),
    getTranslations("documentType"),
    getFormatter(),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin/documents" className="text-sm text-muted underline underline-offset-2 hover:text-ink">
        {tDetail("backToDocuments")}
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">{document.title}</h1>
          {document.description ? <p className="mt-1 text-sm text-muted">{document.description}</p> : null}
        </div>
        <AdminDocumentActions document={document} grades={grades} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ModerationStatusBadge status={document.moderationStatus} />
        <Badge variant="outline">{tDocumentType(documentTypeMessageKey(document.documentType))}</Badge>
        <Badge variant="outline">
          {document.sourceType === "YOUTUBE" ? tDetail("sourceYoutube") : tDetail("sourceFile")}
        </Badge>
      </div>

      {document.moderationStatus === "PENDING" ? (
        <Link
          href={`/moderation/${document.id}`}
          className="mt-3 inline-block text-sm font-medium text-accent hover:text-accent-strong"
        >
          {tDetail("reviewInModeration")}
        </Link>
      ) : null}

      <Card className="mt-6 p-4">
        <h2 className="font-display text-base font-semibold tracking-tight text-ink">{tDetail("sourceSection")}</h2>
        {document.sourceType === "YOUTUBE" && document.externalVideoId ? (
          <a
            href={buildYouTubeWatchUrl(document.externalVideoId)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-sm text-accent hover:text-accent-strong"
          >
            {tDetail("openOnYoutube")}
          </a>
        ) : (
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted">{tDetail("fileName")}</dt>
              <dd className="mt-1 font-medium text-ink">{document.fileName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">{tDetail("fileSize")}</dt>
              <dd className="mt-1 font-medium text-ink">{formatFileSize(document.fileSize) ?? "—"}</dd>
            </div>
          </dl>
        )}
      </Card>

      <Card className="mt-4 p-4">
        <h2 className="font-display text-base font-semibold tracking-tight text-ink">{tDetail("taxonomySection")}</h2>
        {document.lesson ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="outline">{document.grade?.name}</Badge>
            <Badge variant="outline">{document.subjectRef?.name}</Badge>
            <Badge variant="outline">{document.lesson.name}</Badge>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">{tDetail("noTaxonomy")}</p>
        )}
      </Card>

      <Card className="mt-4 p-4">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-muted">{tDetail("uploader")}</dt>
            <dd className="mt-1 font-medium text-ink">{document.uploadedBy?.name ?? tDetail("unknownUploader")}</dd>
          </div>
          <div>
            <dt className="text-muted">{tDetail("createdAt")}</dt>
            <dd className="mt-1 font-medium text-ink">{format.dateTime(document.createdAt, "dateTimeShort")}</dd>
          </div>
          {document.reviewedAt ? (
            <div>
              <dt className="text-muted">{tDetail("reviewedAt")}</dt>
              <dd className="mt-1 font-medium text-ink">{format.dateTime(document.reviewedAt, "dateTimeShort")}</dd>
            </div>
          ) : null}
          {document.reviewedBy ? (
            <div>
              <dt className="text-muted">{tDetail("reviewedBy")}</dt>
              <dd className="mt-1 font-medium text-ink">{document.reviewedBy.name}</dd>
            </div>
          ) : null}
          {document.rejectionReason ? (
            <div className="col-span-2">
              <dt className="text-muted">{tDetail("rejectionReason")}</dt>
              <dd className="mt-1 font-medium text-ink">{document.rejectionReason}</dd>
            </div>
          ) : null}
        </dl>
      </Card>

      <Card className="mt-4 p-4">
        <h2 className="font-display text-base font-semibold tracking-tight text-ink">{tDetail("activity")}</h2>
        <dl className="mt-3 grid grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-muted">{tDetail("ratings")}</dt>
            <dd className="mt-1 font-medium text-ink">{document.counts.ratings}</dd>
          </div>
          <div>
            <dt className="text-muted">{tDetail("comments")}</dt>
            <dd className="mt-1 font-medium text-ink">{document.counts.comments}</dd>
          </div>
          <div>
            <dt className="text-muted">{tDetail("reports")}</dt>
            <dd className="mt-1 font-medium text-ink">{document.counts.reports}</dd>
          </div>
        </dl>
      </Card>

      <Link
        href={`/documents/${document.id}`}
        className="mt-6 inline-block text-sm font-medium text-accent hover:text-accent-strong"
      >
        {tDetail("viewPublicDetail")}
      </Link>
    </div>
  );
}
