import Link from "next/link";
import { notFound } from "next/navigation";
import { FilePreview } from "@/components/FilePreview";
import { ModerationActions } from "@/components/moderation/ModerationActions";
import { ModerationStatusBadge } from "@/components/moderation/ModerationStatusBadge";
import { requireRole } from "@/lib/auth/authorize";
import { getModerationDocumentById } from "@/lib/moderation/moderation";

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

export default async function ModerationDetailPage({ params }: ModerationDetailPageProps) {
  await requireRole("ADMIN");
  const { id } = await params;

  const doc = await getModerationDocumentById(id);
  if (!doc) notFound();

  const taxonomy = [doc.grade?.name, doc.subjectRef?.name, doc.lesson?.name].filter(Boolean).join(" · ");
  const isPending = doc.moderationStatus === "PENDING";

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:py-10">
      <Link href="/moderation" className="text-sm text-muted transition-colors hover:text-ink">
        ← Back to moderation
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">{doc.title}</h1>
        <ModerationStatusBadge status={doc.moderationStatus} />
      </div>
      {taxonomy ? <p className="mt-1 text-sm text-muted">{taxonomy}</p> : null}
      {doc.description ? <p className="mt-4 text-sm leading-relaxed text-ink/80">{doc.description}</p> : null}

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-line bg-card p-4 text-sm sm:grid-cols-3">
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
