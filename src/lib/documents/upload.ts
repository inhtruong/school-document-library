import "server-only";
import type { Document, Grade, Lesson, Role, Subject } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_MB } from "@/lib/documents/upload-config";
import { validateTaxonomySelection } from "@/lib/documents/taxonomy";
import { createNewDocumentNotifications } from "@/lib/notifications/notification";
import {
  buildFileKey,
  deleteLocalFile,
  matchesFileSignature,
  resolveFileFormat,
  writeLocalFile,
} from "@/lib/storage/local-storage";
import { uploadDocumentSchema } from "@/lib/validation/document";

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

  let document: UploadedDocument;
  try {
    document = await prisma.document.create({
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
        fileKey,
        fileName: file.name.trim().slice(0, 200) || `document${format.extension}`,
        fileSize: file.size,
        mimeType: file.type,
        fileCategory: format.category,
        uploadedById: input.uploaderId,
      },
      include: {
        uploadedBy: { select: { id: true, name: true, role: true } },
        grade: true,
        subjectRef: true,
        lesson: true,
      },
    });
  } catch (error) {
    console.error(
      "Document creation failed after a successful file write; cleaning up orphan file",
      error
    );
    await deleteLocalFile(fileKey);
    return { success: false, error: "Failed to save the document. Please try again.", status: 500 };
  }

  // The Document is already saved at this point — notification generation
  // is best-effort and must never roll back or fail an otherwise-successful
  // upload (Step 8C). Its own try/catch keeps it fully isolated from the
  // Document-creation try/catch above, which would otherwise mistake a
  // notification failure for a Document-creation failure and delete the
  // just-written file.
  if (document.uploadedBy) {
    try {
      await createNewDocumentNotifications(document, document.uploadedBy);
    } catch (error) {
      console.error("Notification generation failed for a new document upload", error);
    }
  }

  return { success: true, document };
}
