export type DocumentRecord = {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  documentType: string;
  academicYear: string;
  createdAt: string;
  updatedAt: string;
};

export type SubjectSummary = {
  subject: string;
  count: number;
};
