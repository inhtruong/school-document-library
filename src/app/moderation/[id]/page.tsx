import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { FilePreview } from "@/components/FilePreview";
import { ModerationActions } from "@/components/moderation/ModerationActions";
import { ModerationStatusBadge } from "@/components/moderation/ModerationStatusBadge";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/authorize";
import { getModerationDocumentById } from "@/lib/moderation/moderation";
import { MODERATION_STATUS_COLOR } from "@/lib/moderation/moderation-status-style";

type ModerationDetailPageProps = {
  params: Promise<{ id: string }>;
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
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

  const taxonomy = [doc.grade?.name, doc.subjectRef?.name, doc.lesson?.name].filter(Boolean).join(" · ");
  const isPending = doc.moderationStatus === "PENDING";
  const StatusIcon = STATUS_ICON[doc.moderationStatus];
  const statusColor = MODERATION_STATUS_COLOR[doc.moderationStatus];

  // Context line for the status banner — who's waiting on this, or who
  // already decided it. Kept distinct from the metadata grid below (which
  // repeats Uploaded/Reviewed for reference), since this is the ONE thing
  // an Admin should absorb in the first second on the page.
  const bannerContext = isPending
    ? doc.uploadedBy
      ? `Uploaded by ${doc.uploadedBy.name} · waiting since ${formatDate(doc.createdAt)}`
      : `Waiting since ${formatDate(doc.createdAt)}`
    : `Reviewed by ${doc.reviewedBy?.name ?? "an unavailable reviewer"} on ${formatDate(doc.reviewedAt) ?? "an unknown date"}`;

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:py-10">
      <Link href="/moderation" className="text-sm text-muted transition-colors hover:text-ink">
        ← Back to moderation
      </Link>

      <div
        className="mt-4 flex items-start gap-3 rounded-xl border p-4"
        style={{ borderColor: `${statusColor}33`, backgroundColor: `${statusColor}0d` }}
      >
        <StatusIcon className="mt-0.5 h-5 w-5 shrink-0" style={{ color: statusColor }} aria-hidden />
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold tracking-tight" style={{ color: statusColor }}>
            {isPending ? "Pending review" : doc.moderationStatus === "APPROVED" ? "Approved — publicly visible" : "Rejected"}
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
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Uploader</dt>
            <dd className="mt-0.5 text-ink">
              {doc.uploadedBy ? `${doc.uploadedBy.name} (${doc.uploadedBy.role})` : "Unknown"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Document type</dt>
            <dd className="mt-0.5 text-ink">{doc.documentType}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Academic year</dt>
            <dd className="mt-0.5 text-ink">{doc.academicYear}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">File</dt>
            <dd className="mt-0.5 truncate text-ink">{doc.fileName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">File size</dt>
            <dd className="mt-0.5 text-ink">{formatFileSize(doc.fileSize) ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Uploaded</dt>
            <dd className="mt-0.5 text-ink">{formatDate(doc.createdAt)}</dd>
          </div>
          {!isPending ? (
            <>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Reviewed</dt>
                <dd className="mt-0.5 text-ink">{formatDate(doc.reviewedAt) ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Reviewer</dt>
                {/* reviewedById is SetNull if the reviewer account is later deleted — handled gracefully, never crashes. */}
                <dd className="mt-0.5 text-ink">{doc.reviewedBy?.name ?? "Reviewer unavailable"}</dd>
              </div>
            </>
          ) : null}
        </dl>
      </Card>

      {doc.moderationStatus === "REJECTED" && doc.rejectionReason ? (
        <div className="mt-6 rounded-xl border border-destructive-soft bg-destructive-soft p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-destructive">Rejection reason</p>
          <p className="mt-1 text-sm text-ink">{doc.rejectionReason}</p>
        </div>
      ) : null}

      <div className="mt-8">
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink">Preview</h2>
        <div className="mt-3">
          <FilePreview
            documentId={doc.id}
            fileCategory={doc.fileCategory}
            mimeType={doc.mimeType}
            fileName={doc.fileName}
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
