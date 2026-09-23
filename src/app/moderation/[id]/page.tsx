import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { FilePreview } from "@/components/FilePreview";
import { ModerationActions } from "@/components/moderation/ModerationActions";
import { ModerationStatusBadge } from "@/components/moderation/ModerationStatusBadge";
import { Card } from "@/components/ui/card";
import type { DateTimeFormatter } from "@/i18n/formats";
import { requireRole } from "@/lib/auth/authorize";
import { documentTypeMessageKey } from "@/lib/documents/document-type";
import type { DocumentTypeValue } from "@/lib/documents/document-type";
import { getModerationDocumentById } from "@/lib/moderation/moderation";
import { MODERATION_STATUS_COLOR } from "@/lib/moderation/moderation-status-style";

type ModerationDetailPageProps = {
  params: Promise<{ id: string }>;
};

function formatDate(iso: string | null, format: DateTimeFormatter): string | null {
  if (!iso) return null;
  return format.dateTime(new Date(iso), "dateTimeLong");
}

function formatFileSize(bytes: number | null): string | null {
  if (bytes === null) return null;
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_ICON = { PENDING: Clock, APPROVED: CheckCircle2, REJECTED: XCircle } as const;

export default async function ModerationDetailPage({ params }: ModerationDetailPageProps) {
  await requireRole("ADMIN");
  const { id } = await params;

  const doc = await getModerationDocumentById(id);
  if (!doc) notFound();

  const [tModeration, tCommon, tDocumentType, format] = await Promise.all([
    getTranslations("moderation"),
    getTranslations("common"),
    getTranslations("documentType"),
    getFormatter(),
  ]);

  const taxonomy = [doc.grade?.name, doc.subjectRef?.name, doc.lesson?.name].filter(Boolean).join(" · ");
  const isPending = doc.moderationStatus === "PENDING";
  const StatusIcon = STATUS_ICON[doc.moderationStatus];
  const statusColor = MODERATION_STATUS_COLOR[doc.moderationStatus];

  // Context line for the status banner — who's waiting on this, or who
  // already decided it. Kept distinct from the metadata grid below (which
  // repeats Uploaded/Reviewed for reference), since this is the ONE thing
  // an Admin should absorb in the first second on the page.
  const formattedCreatedAt = formatDate(doc.createdAt, format) ?? "";
  const bannerContext = isPending
    ? doc.uploadedBy
      ? tModeration("uploadedByWaitingSince", { name: doc.uploadedBy.name, date: formattedCreatedAt })
      : tModeration("waitingSince", { date: formattedCreatedAt })
    : tModeration("reviewedByOn", {
        name: doc.reviewedBy?.name ?? tModeration("unavailableReviewer"),
        date: formatDate(doc.reviewedAt, format) ?? tModeration("unknownDate"),
      });

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:py-10">
      <Link href="/moderation" className="text-sm text-muted transition-colors hover:text-ink">
        {tModeration("backToModeration")}
      </Link>

      <div
        className="mt-4 flex items-start gap-3 rounded-xl border p-4"
        style={{ borderColor: `${statusColor}33`, backgroundColor: `${statusColor}0d` }}
      >
        <StatusIcon className="mt-0.5 h-5 w-5 shrink-0" style={{ color: statusColor }} aria-hidden />
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold tracking-tight" style={{ color: statusColor }}>
            {isPending
              ? tModeration("pendingReview")
              : doc.moderationStatus === "APPROVED"
                ? tModeration("approvedPubliclyVisible")
                : tModeration("status.rejected")}
          </p>
          <p className="mt-0.5 text-sm text-muted">{bannerContext}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">{doc.title}</h1>
        <ModerationStatusBadge status={doc.moderationStatus} />
      </div>
      {taxonomy ? <p className="mt-1 text-sm text-muted">{taxonomy}</p> : null}
      {doc.description ? <p className="mt-4 text-sm leading-relaxed text-ink/80">{doc.description}</p> : null}

      <Card className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 p-4 text-sm sm:grid-cols-3">
        <dl className="contents">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">{tCommon("uploader")}</dt>
            <dd className="mt-0.5 text-ink">
              {doc.uploadedBy ? `${doc.uploadedBy.name} (${doc.uploadedBy.role})` : tCommon("unknown")}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">{tCommon("documentType")}</dt>
            <dd className="mt-0.5 text-ink">
              {tDocumentType(documentTypeMessageKey(doc.documentType as DocumentTypeValue))}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">{tCommon("academicYear")}</dt>
            <dd className="mt-0.5 text-ink">{doc.academicYear}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">{tModeration("file")}</dt>
            <dd className="mt-0.5 truncate text-ink">{doc.fileName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">{tModeration("fileSize")}</dt>
            <dd className="mt-0.5 text-ink">{formatFileSize(doc.fileSize) ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">{tModeration("uploaded")}</dt>
            <dd className="mt-0.5 text-ink">{formatDate(doc.createdAt, format)}</dd>
          </div>
          {!isPending ? (
            <>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">{tModeration("reviewed")}</dt>
                <dd className="mt-0.5 text-ink">{formatDate(doc.reviewedAt, format) ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">{tModeration("reviewer")}</dt>
                {/* reviewedById is SetNull if the reviewer account is later deleted — handled gracefully, never crashes. */}
                <dd className="mt-0.5 text-ink">{doc.reviewedBy?.name ?? tModeration("reviewerUnavailable")}</dd>
              </div>
            </>
          ) : null}
        </dl>
      </Card>

      {doc.moderationStatus === "REJECTED" && doc.rejectionReason ? (
        <div className="mt-6 rounded-xl border border-destructive-soft bg-destructive-soft p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-destructive">{tModeration("rejectionReason")}</p>
          <p className="mt-1 text-sm text-ink">{doc.rejectionReason}</p>
        </div>
      ) : null}

      <div className="mt-8">
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink">{tCommon("preview")}</h2>
        <div className="mt-3">
          <FilePreview
            documentId={doc.id}
            fileCategory={doc.fileCategory}
            mimeType={doc.mimeType}
            fileName={doc.fileName}
            sourceType={doc.sourceType}
            externalVideoId={doc.externalVideoId}
            sourceUrl={doc.sourceUrl}
          />
        </div>
      </div>

      {isPending ? (
        <div className="mt-8 border-t border-line pt-6">
          <ModerationActions documentId={doc.id} documentTitle={doc.title} />
        </div>
      ) : null}
    </div>
  );
}
