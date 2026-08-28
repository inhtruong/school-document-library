import { redirect } from "next/navigation";
import { AlertCircle, Info } from "lucide-react";
import { TaxonomySelectFields } from "@/components/TaxonomySelectFields";
import { FileDropzone } from "@/components/upload/FileDropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireRole } from "@/lib/auth/authorize";
import { listGrades } from "@/lib/documents/grades";
import { MAX_UPLOAD_SIZE_MB } from "@/lib/documents/upload-config";
import { uploadDocument } from "@/lib/documents/upload";
import { TOAST_KEYS } from "@/lib/toast-messages";

const ACCEPTED_FILE_EXTENSIONS =
  ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.mp4,.webm";
const ACCEPTED_FORMATS_LABEL = "PDF, Word, Excel, images, or video";

type UploadPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function UploadPage({ searchParams }: UploadPageProps) {
  const session = await requireRole(["TEACHER", "ADMIN"]);
  const [{ error }, grades] = await Promise.all([searchParams, listGrades()]);

  async function uploadAction(formData: FormData) {
    "use server";

    const session = await requireRole(["TEACHER", "ADMIN"]);
    const result = await uploadDocument({
      uploaderId: session.user.id,
      uploaderRole: session.user.role,
      formData,
    });

    if (!result.success) {
      const notify = result.status !== 400 ? "&notify=1" : "";
      redirect(`/upload?error=${encodeURIComponent(result.error)}${notify}`);
    }

    // FEAT-10C: a Teacher's upload lands PENDING (not yet public), so the
    // success toast must say so rather than implying immediate publication
    // — only an ADMIN's (already-APPROVED) upload gets the plain message.
    const toastKey =
      result.document.moderationStatus === "PENDING" ? TOAST_KEYS.uploadPendingReview : TOAST_KEYS.uploadSuccess;
    // Bug report: landing on the just-uploaded document's detail page still
    // showed "Back to search" instead of returning to where a Teacher would
    // actually expect — their own upload list. Only TEACHER gets `from=
    // my-uploads` here: /my-uploads is TEACHER-only, so an ADMIN upload
    // (immediately APPROVED, found via normal search) keeps the default
    // "Back to search" instead of a link they'd be redirected away from.
    const from = session.user.role === "TEACHER" ? "&from=my-uploads" : "";
    redirect(`/documents/${result.document.id}?toast=${toastKey}${from}`);
  }

  const isTeacher = session.user.role === "TEACHER";

  return (
    <div className="mx-auto max-w-lg px-5 py-8 sm:py-10">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Upload document</h1>
      <p className="mt-2 text-sm text-muted">Share a lesson note, exercise, or reference with your school.</p>

      <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-accent-soft bg-accent-soft p-3.5">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
        <p className="text-sm text-ink">
          {isTeacher
            ? "An admin reviews new uploads before they appear in search — usually quick, and you'll see the status in My uploads."
            : "As an admin, your upload goes live immediately — no review needed."}
        </p>
      </div>

      {error ? (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-destructive-soft bg-destructive-soft p-3.5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : null}

      <form action={uploadAction} className="mt-8 flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted">Document details</h2>

          <label className="flex flex-col gap-1.5 text-sm" htmlFor="upload-title">
            Title
            <Input id="upload-title" name="title" type="text" required />
          </label>

          <label className="flex flex-col gap-1.5 text-sm" htmlFor="upload-description">
            Description <span className="font-normal text-muted">(optional)</span>
            <textarea
              id="upload-description"
              name="description"
              rows={3}
              placeholder="What does this document cover?"
              className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
            />
          </label>
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted">Where it belongs</h2>

          <TaxonomySelectFields grades={grades} />

          <label className="flex flex-col gap-1.5 text-sm" htmlFor="upload-academicYear">
            Academic year
            <Input id="upload-academicYear" name="academicYear" type="text" placeholder="e.g. 2025-2026" required />
          </label>
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted">Attach the file</h2>

          <FileDropzone
            id="upload-file"
            name="file"
            accept={ACCEPTED_FILE_EXTENSIONS}
            required
            acceptedFormatsLabel={ACCEPTED_FORMATS_LABEL}
            maxSizeMB={MAX_UPLOAD_SIZE_MB}
          />
        </div>

        <Button type="submit" size="lg">
          Upload
        </Button>
      </form>
    </div>
  );
}
