import "server-only";
import type {
  Document,
  DocumentModerationStatus,
  DocumentSourceType,
  FileCategory,
  Grade,
  Lesson,
  Role,
  Subject,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/audit";
import { MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_MB } from "@/lib/documents/upload-config";
import { convertPowerPointToPdf } from "@/lib/documents/powerpoint-conversion";
import { validateTaxonomySelection } from "@/lib/documents/taxonomy";
import { extractYouTubeVideoId } from "@/lib/documents/youtube";
import { createDocumentPendingReviewNotifications, createNewDocumentNotifications } from "@/lib/notifications/notification";
import {
  buildFileKey,
  buildPreviewFileKey,
  deleteLocalFile,
  matchesFileSignature,
  resolveFileFormat,
  writeLocalFile,
} from "@/lib/storage/local-storage";
import { uploadDocumentSchema } from "@/lib/validation/document";

/**
 * The file-related columns that differ between a FILE upload (a real stored
 * object, possibly with a generated preview) and a YOUTUBE "upload" (no
 * file at all — only a validated external video id). Kept as one object so
 * both source-type branches build the exact same shape and the shared
 * `$transaction` below never needs to know which branch produced it.
 */
type FileFields = {
  fileKey: string | null;
  previewFileKey: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  fileCategory: FileCategory | null;
  externalVideoId: string | null;
};

export type UploadedDocument = Document & {
  uploadedBy: { id: string; name: string; role: Role } | null;
  grade: Grade | null;
  subjectRef: Subject | null;
  lesson: Lesson | null;
};

export type UploadDocumentResult =
  | { success: true; document: UploadedDocument }
  | { success: false; error: string; status: 400 | 500 };

function getFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/**
 * Core upload flow: validate metadata, validate the file, store it locally, then
 * create the Document row. `uploaderId` must come from the caller's authenticated
 * session — this function never reads an uploader/owner id out of `formData`.
 */
export async function uploadDocument(input: {
  uploaderId: string;
  /**
   * Optional and defaults to the more-restrictive PENDING behavior when
   * omitted — the real caller (`POST /api/documents/upload`) always
   * passes the authenticated session's role explicitly, never trusting
   * anything from `formData`. Optional only so unit tests that don't
   * care about moderation don't all need updating just to keep compiling.
   */
  uploaderRole?: Role;
  /** FEAT-11: the DOCUMENT_UPLOADED audit actor snapshot. Optional for the same reason as `uploaderRole` — tests that don't care about auditing keep compiling; a real caller always passes `session.user.email ?? null`. */
  uploaderEmail?: string | null;
  formData: FormData;
}): Promise<UploadDocumentResult> {
  const parsedMetadata = uploadDocumentSchema.safeParse({
    title: getFormString(input.formData, "title"),
    description: getFormString(input.formData, "description") || undefined,
    academicYear: getFormString(input.formData, "academicYear"),
    gradeId: getFormString(input.formData, "gradeId"),
    subjectId: getFormString(input.formData, "subjectId"),
    lessonId: getFormString(input.formData, "lessonId"),
    documentType: getFormString(input.formData, "documentType"),
  });

  if (!parsedMetadata.success) {
    return {
      success: false,
      error: parsedMetadata.error.issues[0]?.message ?? "Invalid document data",
      status: 400,
    };
  }

  // Never trust that gradeId/subjectId/lessonId are consistent just because
  // they came from cascading dropdowns — always re-verify against the DB.
  const taxonomy = await validateTaxonomySelection({
    gradeId: parsedMetadata.data.gradeId,
    subjectId: parsedMetadata.data.subjectId,
    lessonId: parsedMetadata.data.lessonId,
  });
  if (!taxonomy.valid) {
    return { success: false, error: taxonomy.error, status: 400 };
  }

  // Business rule (FEAT-10A): Admins are already the moderation authority
  // and don't need to approve their own upload; Teachers require review.
  // Never derived from `formData` — only from the caller's authenticated
  // role. Not a moderation action, so reviewedAt/reviewedById stay null
  // even for the APPROVED case (Prisma leaves unset nullable fields null).
  const moderationStatus: DocumentModerationStatus = input.uploaderRole === "ADMIN" ? "APPROVED" : "PENDING";

  // FEAT-12B: a new orthogonal axis — WHERE the content lives — read directly
  // out of `formData` the same way `file` always has been (it's not part of
  // `uploadDocumentSchema`, which only covers shared metadata). Anything
  // other than the literal string "YOUTUBE" is treated as the pre-existing
  // FILE flow, so this never breaks a form that doesn't send the field at all.
  const sourceType: DocumentSourceType = getFormString(input.formData, "sourceType") === "YOUTUBE" ? "YOUTUBE" : "FILE";

  let fileFields: FileFields;
  let cleanupOnDbFailure: () => Promise<void>;

  if (sourceType === "YOUTUBE") {
    const rawUrl = getFormString(input.formData, "youtubeUrl");
    const videoId = extractYouTubeVideoId(rawUrl);
    if (!videoId) {
      return { success: false, error: "Enter a valid YouTube video URL", status: 400 };
    }

    fileFields = {
      fileKey: null,
      previewFileKey: null,
      fileName: null,
      fileSize: null,
      mimeType: null,
      fileCategory: null,
      externalVideoId: videoId,
    };
    // No file was ever written to storage for a YOUTUBE document, so there is
    // nothing to clean up if the DB transaction below fails.
    cleanupOnDbFailure = async () => {};
  } else {
    const file = input.formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { success: false, error: "A file is required", status: 400 };
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return { success: false, error: `File exceeds the ${MAX_UPLOAD_SIZE_MB} MB limit`, status: 400 };
    }

    const format = resolveFileFormat(file.name, file.type);
    if (!format.valid) {
      return { success: false, error: format.error, status: 400 };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!matchesFileSignature(buffer, format.extension)) {
      return { success: false, error: "File content does not match its declared type", status: 400 };
    }

    const fileKey = buildFileKey(format.category, format.extension);

    const writeResult = await writeLocalFile(fileKey, buffer);
    if (!writeResult.success) {
      console.error("Local file write failed:", writeResult.error);
      return { success: false, error: "Failed to save the file. Please try again.", status: 500 };
    }

    // FEAT-12A: PowerPoint gets a server-side PDF preview, generated here —
    // BEFORE the Document row is ever created — so a Document can never exist
    // in a state where "preview should be available" silently isn't. A
    // conversion failure (including LibreOffice being unavailable at all)
    // fails the whole upload and cleans up the original we just wrote, rather
    // than quietly falling back to "no preview" the way legacy .doc/.xls
    // already do — this format's whole point is an in-browser preview.
    let previewFileKey: string | null = null;
    if (format.category === "POWERPOINT") {
      const conversion = await convertPowerPointToPdf(buffer, format.extension as ".ppt" | ".pptx");
      if (!conversion.success) {
        console.error("PowerPoint conversion failed:", conversion.error);
        await deleteLocalFile(fileKey);
        return {
          success: false,
          error: `Could not generate a preview for this PowerPoint file (${conversion.error}). Please try again.`,
          status: 500,
        };
      }

      previewFileKey = buildPreviewFileKey();
      const previewWriteResult = await writeLocalFile(previewFileKey, conversion.pdf);
      if (!previewWriteResult.success) {
        console.error("Failed to store the generated PowerPoint preview:", previewWriteResult.error);
        await deleteLocalFile(fileKey);
        return { success: false, error: "Failed to save the generated preview. Please try again.", status: 500 };
      }
    }

    fileFields = {
      fileKey,
      previewFileKey,
      fileName: file.name.trim().slice(0, 200) || `document${format.extension}`,
      fileSize: file.size,
      mimeType: file.type,
      fileCategory: format.category,
      externalVideoId: null,
    };
    cleanupOnDbFailure = async () => {
      await deleteLocalFile(fileKey);
      if (previewFileKey) await deleteLocalFile(previewFileKey);
    };
  }

  let document: UploadedDocument;
  try {
    // FEAT-11 §16: the file write already happened above, so wrapping just
    // the Document row + its DOCUMENT_UPLOADED audit row in one transaction
    // makes THAT pair atomic without holding a transaction open across the
    // (already-completed) file I/O. A failure anywhere in here — including
    // the audit insert — is caught below exactly like a plain create()
    // failure always was, reusing the existing orphan-file cleanup path.
    document = await prisma.$transaction(async (tx) => {
      const created = await tx.document.create({
        data: {
          title: parsedMetadata.data.title,
          description: parsedMetadata.data.description,
          academicYear: parsedMetadata.data.academicYear,
          documentType: parsedMetadata.data.documentType,
          // Legacy free-text field, auto-derived from the taxonomy Subject's
          // name so homepage/search grouping (which still reads this field)
          // keeps working unchanged for taxonomy-backed uploads too.
          subject: taxonomy.subject.name,
          gradeId: taxonomy.grade.id,
          subjectId: taxonomy.subject.id,
          lessonId: taxonomy.lesson.id,
          sourceType,
          ...fileFields,
          uploadedById: input.uploaderId,
          moderationStatus,
        },
        include: {
          uploadedBy: { select: { id: true, name: true, role: true } },
          grade: true,
          subjectRef: true,
          lesson: true,
        },
      });

      await writeAuditLog(
        {
          actor: { id: input.uploaderId, email: input.uploaderEmail ?? null, role: input.uploaderRole ?? null },
          action: "DOCUMENT_UPLOADED",
          entityType: "DOCUMENT",
          entityId: created.id,
          metadata: { documentTitle: created.title },
        },
        tx
      );

      return created;
    });
  } catch (error) {
    console.error(
      "Document creation failed after a successful file write; cleaning up orphan file(s)",
      error
    );
    await cleanupOnDbFailure();
    return { success: false, error: "Failed to save the document. Please try again.", status: 500 };
  }

  // The Document is already saved at this point — notification generation
  // is best-effort and must never roll back or fail an otherwise-successful
  // upload (Step 8C). Its own try/catch keeps it fully isolated from the
  // Document-creation try/catch above, which would otherwise mistake a
  // notification failure for a Document-creation failure and delete the
  // just-written file.
  //
  // FEAT-10F trade-off: unlike resubmit/approve/reject (pure-DB
  // transitions, now wrapped in `$transaction` with their notifications),
  // upload's notification stays best-effort/non-transactional on purpose.
  // The real state change here already spans a non-DB resource — the file
  // write to local storage happens BEFORE this point and can't be rolled
  // back by a Postgres transaction — so wrapping just document.create()+
  // notification in one `$transaction` wouldn't actually make the whole
  // operation atomic, only add a new failure mode: a transient notification
  // hiccup would force a successfully-validated, already-stored upload to
  // be reported as failed (and its orphan file deleted) to the Teacher.
  // That's a worse outcome for a routine "please review this" ping than
  // just logging and moving on. A rare failure here still leaves the
  // document fully visible via /moderation's queue regardless.
  //
  // APPROVED (an Admin's direct upload): notify followers immediately — a
  // publication event. PENDING (a Teacher's upload): no follower
  // notification (FEAT-10A — a PENDING doc isn't visible to followers
  // yet), but every ADMIN gets a "needs review" notification, since
  // otherwise the only way to discover it was to manually check
  // /moderation (user-reported gap).
  if (document.uploadedBy && moderationStatus === "APPROVED") {
    try {
      await createNewDocumentNotifications(document, document.uploadedBy);
    } catch (error) {
      console.error("Notification generation failed for a new document upload", error);
    }
  } else if (moderationStatus === "PENDING") {
    try {
      await createDocumentPendingReviewNotifications(document, document.uploadedBy);
    } catch (error) {
      console.error("Pending-review notification generation failed for a new document upload", error);
    }
  }

  return { success: true, document };
}
