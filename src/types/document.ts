import type { DocumentTypeValue } from "@/lib/documents/document-type";

export type GradeSummary = { id: string; name: string; code: string; sortOrder: number };
export type SubjectTaxonomySummary = { id: string; name: string; code: string; gradeId: string };
export type LessonSummary = { id: string; name: string; code: string; subjectId: string };

export type DocumentRecord = {
  id: string;
  title: string;
  description: string | null;
  /** Legacy free-text classification — see Document.subject in schema.prisma. */
  subject: string;
  documentType: DocumentTypeValue;
  academicYear: string;
  gradeId: string | null;
  subjectId: string | null;
  lessonId: string | null;
  /** Only populated where the API includes the relation. */
  grade?: GradeSummary | null;
  subjectRef?: SubjectTaxonomySummary | null;
  lesson?: LessonSummary | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  fileCategory: "PDF" | "WORD" | "EXCEL" | "IMAGE" | "VIDEO" | null;
  uploadedById: string | null;
  /** Only populated by the document-detail endpoint, which includes the relation. */
  uploadedBy?: { id: string; name: string; role: "STUDENT" | "TEACHER" | "ADMIN" } | null;
  createdAt: string;
  updatedAt: string;
};

export type SubjectSummary = {
  subject: string;
  count: number;
};
