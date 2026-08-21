export type DocumentRecord = {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  documentType: string;
  academicYear: string;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  fileCategory: "PDF" | "WORD" | "EXCEL" | "IMAGE" | "VIDEO" | null;
  uploadedById: string | null;
  /** Only populated by the document-detail endpoint, which includes the relation. */
  uploadedBy?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type SubjectSummary = {
  subject: string;
  count: number;
};
