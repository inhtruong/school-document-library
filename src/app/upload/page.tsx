import { redirect } from "next/navigation";
import { TaxonomySelectFields } from "@/components/TaxonomySelectFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireRole } from "@/lib/auth/authorize";
import { listGrades } from "@/lib/documents/grades";
import { MAX_UPLOAD_SIZE_MB } from "@/lib/documents/upload-config";
import { uploadDocument } from "@/lib/documents/upload";
import { TOAST_KEYS } from "@/lib/toast-messages";

const ACCEPTED_FILE_EXTENSIONS =
  ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.mp4,.webm";

type UploadPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function UploadPage({ searchParams }: UploadPageProps) {
  await requireRole(["TEACHER", "ADMIN"]);
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

    redirect(`/documents/${result.document.id}?toast=${TOAST_KEYS.uploadSuccess}`);
  }

  return (
    <div className="mx-auto max-w-lg px-5 py-8 sm:py-10">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Upload document</h1>
      <p className="mt-2 text-sm text-muted">
        PDF, Word, Excel, images, or video — up to {MAX_UPLOAD_SIZE_MB} MB.
      </p>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <form action={uploadAction} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm" htmlFor="upload-title">
          Title
          <Input id="upload-title" name="title" type="text" required />
        </label>

        <TaxonomySelectFields grades={grades} />

        <label className="flex flex-col gap-1.5 text-sm" htmlFor="upload-academicYear">
          Academic year
          <Input id="upload-academicYear" name="academicYear" type="text" required />
        </label>

        <label className="flex flex-col gap-1.5 text-sm" htmlFor="upload-description">
          Description
          <textarea
            id="upload-description"
            name="description"
            rows={3}
            className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm" htmlFor="upload-file">
          File (PDF, Word, Excel, image, or video)
          <input
            id="upload-file"
            name="file"
            type="file"
            accept={ACCEPTED_FILE_EXTENSIONS}
            required
            className="text-sm text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />
        </label>

        <Button type="submit">Upload</Button>
      </form>
    </div>
  );
}
