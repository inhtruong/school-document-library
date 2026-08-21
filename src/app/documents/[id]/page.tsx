import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fetchDocumentById } from "@/lib/api-client";
import { subjectAccent } from "@/lib/subjects";

type DocumentDetailPageProps = {
  params: Promise<{ id: string }>;
};

function formatDate(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const CATEGORY_LABELS: Record<string, string> = {
  PDF: "PDF",
  WORD: "Word document",
  EXCEL: "Excel spreadsheet",
  IMAGE: "Image",
  VIDEO: "Video",
};

export default async function DocumentDetailPage({ params }: DocumentDetailPageProps) {
  const { id } = await params;
  const doc = await fetchDocumentById(id);

  if (!doc) notFound();

  const createdLabel = formatDate(doc.createdAt);

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:py-10">
      <Link href="/search" className="text-sm text-muted transition-colors hover:text-ink">
        ← Back to search
      </Link>

      <div className="mt-6 flex gap-4">
        <span
          aria-hidden
          className="w-1 shrink-0 self-stretch rounded-full"
          style={{ backgroundColor: subjectAccent(doc.subject) }}
        />

        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
            {doc.title}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-ink">{doc.subject}</span>
            <Badge>{doc.documentType}</Badge>
            <span className="text-sm text-muted">{doc.academicYear}</span>
          </div>

          {createdLabel ? <p className="mt-2 text-xs text-muted">Added {createdLabel}</p> : null}
        </div>
      </div>

      {doc.description ? (
        <p className="mt-6 text-sm leading-relaxed text-ink/80 sm:text-base">{doc.description}</p>
      ) : null}

      {doc.fileName ? (
        <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm text-muted">
          <dt>File</dt>
          <dd className="text-ink">
            {doc.fileName}
            {doc.fileSize ? ` (${formatFileSize(doc.fileSize)})` : ""}
          </dd>
          {doc.fileCategory ? (
            <>
              <dt>Type</dt>
              <dd className="text-ink">{CATEGORY_LABELS[doc.fileCategory] ?? doc.fileCategory}</dd>
            </>
          ) : null}
          {doc.uploadedBy ? (
            <>
              <dt>Uploaded by</dt>
              <dd className="text-ink">{doc.uploadedBy.name}</dd>
            </>
          ) : null}
        </dl>
      ) : null}

      <Card className="mt-8 flex flex-col items-center justify-center gap-2 border-dashed bg-surface px-6 py-16 text-center">
        <p className="text-sm text-muted">Document preview will be available here.</p>
      </Card>

      <div className="mt-6">
        <Button disabled title="Downloads aren't available yet">
          Download
        </Button>
      </div>
    </div>
  );
}
