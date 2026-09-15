import "server-only";
import type { DocumentModerationStatus, DocumentSourceType, FileCategory, Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DocumentTypeValue } from "@/lib/documents/document-type";
import { resolveSearchTaxonomyFilters } from "@/lib/documents/search-filters";
import { ADMIN_DOCUMENTS_PAGE_SIZE } from "@/lib/admin/admin-documents-config";

export type AdminDocumentFilter = {
  search?: string;
  status?: DocumentModerationStatus;
  sourceType?: DocumentSourceType;
  documentType?: DocumentTypeValue;
  gradeId?: string;
  subjectId?: string;
  lessonId?: string;
};

export type AdminDocumentListItem = {
  id: string;
  title: string;
  moderationStatus: DocumentModerationStatus;
  sourceType: DocumentSourceType;
  documentType: DocumentTypeValue;
  fileCategory: FileCategory | null;
  createdAt: Date;
  academicYear: string;
  uploadedBy: { id: string; name: string } | null;
  grade: { name: string } | null;
  subjectRef: { name: string } | null;
  lesson: { name: string } | null;
};

export type AdminDocumentListPage = {
  documents: AdminDocumentListItem[];
  total: number;
  page: number;
  totalPages: number;
};

/**
 * Admin-only browse — deliberately NOT `searchDocuments()` (`src/lib/
 * documents/search.ts`), which hardcodes `APPROVED_DOCUMENT_WHERE` with no
 * opt-out and omits fields Admin needs. Mirrors its where/orderBy/
 * pagination shape and `resolveSearchTaxonomyFilters()` reuse instead,
 * same "admin sees every status, filtered in SQL" precedent as
 * `listModerationDocuments()`.
 */
export async function listAdminDocuments(filter: AdminDocumentFilter, page: number): Promise<AdminDocumentListPage> {
  const taxonomy = await resolveSearchTaxonomyFilters({
    gradeId: filter.gradeId,
    subjectId: filter.subjectId,
    lessonId: filter.lessonId,
  });

  const skip = (page - 1) * ADMIN_DOCUMENTS_PAGE_SIZE;
  const where: Prisma.DocumentWhereInput = {
    ...(filter.status ? { moderationStatus: filter.status } : {}),
    ...(filter.sourceType ? { sourceType: filter.sourceType } : {}),
    ...(filter.documentType ? { documentType: filter.documentType } : {}),
    ...(taxonomy.gradeId ? { gradeId: taxonomy.gradeId } : {}),
    ...(taxonomy.subjectId ? { subjectId: taxonomy.subjectId } : {}),
    ...(taxonomy.lessonId ? { lessonId: taxonomy.lessonId } : {}),
    ...(filter.search
      ? {
          OR: [
            { title: { contains: filter.search, mode: "insensitive" } },
            { description: { contains: filter.search, mode: "insensitive" } },
            { subject: { contains: filter.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: ADMIN_DOCUMENTS_PAGE_SIZE,
      select: {
        id: true,
        title: true,
        moderationStatus: true,
        sourceType: true,
        documentType: true,
        fileCategory: true,
        createdAt: true,
        academicYear: true,
        uploadedBy: { select: { id: true, name: true } },
        grade: { select: { name: true } },
        subjectRef: { select: { name: true } },
        lesson: { select: { name: true } },
      },
    }),
    prisma.document.count({ where }),
  ]);

  return {
    documents: documents as AdminDocumentListItem[],
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / ADMIN_DOCUMENTS_PAGE_SIZE)),
  };
}

export type AdminDocumentDetail = {
  id: string;
  title: string;
  description: string | null;
  documentType: DocumentTypeValue;
  academicYear: string;
  sourceType: DocumentSourceType;
  externalVideoId: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  fileCategory: FileCategory | null;
  moderationStatus: DocumentModerationStatus;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  uploadedBy: { id: string; name: string; role: Role } | null;
  reviewedBy: { id: string; name: string } | null;
  grade: { id: string; name: string } | null;
  subjectRef: { id: string; name: string } | null;
  lesson: { id: string; name: string } | null;
  counts: { ratings: number; comments: number; reports: number };
};

/**
 * One query, no N+1 — full taxonomy objects (ids included, for the edit
 * dialog's pre-selected triplet) + reviewedBy/rejectionReason (which the
 * public `getDocumentById()` deliberately omits) + safe aggregate counts.
 * Never selects `fileKey`/`previewFileKey`.
 */
export async function getAdminDocumentById(id: string): Promise<AdminDocumentDetail | null> {
  const document = await prisma.document.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      documentType: true,
      academicYear: true,
      sourceType: true,
      externalVideoId: true,
      fileName: true,
      fileSize: true,
      mimeType: true,
      fileCategory: true,
      moderationStatus: true,
      reviewedAt: true,
      rejectionReason: true,
      createdAt: true,
      uploadedBy: { select: { id: true, name: true, role: true } },
      reviewedBy: { select: { id: true, name: true } },
      grade: { select: { id: true, name: true } },
      subjectRef: { select: { id: true, name: true } },
      lesson: { select: { id: true, name: true } },
      _count: { select: { ratings: true, comments: true, reports: true } },
    },
  });
  if (!document) return null;

  const { _count, ...rest } = document;
  return { ...rest, counts: _count } as AdminDocumentDetail;
}
