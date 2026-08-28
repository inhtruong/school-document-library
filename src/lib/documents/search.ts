import "server-only";
import type { Document, Grade, Lesson, Subject } from "@prisma/client";
import type { DocumentTypeValue } from "@/lib/documents/document-type";
import { prisma } from "@/lib/prisma";
import { resolveSearchTaxonomyFilters, type ResolvedTaxonomyFilters } from "@/lib/documents/search-filters";
import { SEARCH_PAGE_SIZE, SORT_ORDER_BY, type SortValue } from "@/lib/documents/search-query";
import { APPROVED_DOCUMENT_WHERE } from "@/lib/documents/visibility";
import type { DocumentRecord } from "@/types/document";

type DocumentWithTaxonomy = Omit<Document, "fileKey" | "reviewedById" | "rejectionReason"> & {
  grade: Grade | null;
  subjectRef: Subject | null;
  lesson: Lesson | null;
};

function toDocumentRecord(document: DocumentWithTaxonomy): DocumentRecord {
  return {
    ...document,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    reviewedAt: document.reviewedAt ? document.reviewedAt.toISOString() : null,
  };
}

export type SearchDocumentsParams = {
  search?: string;
  /** Legacy free-text `Document.subject` filter (predates the taxonomy). */
  legacySubject?: string;
  gradeId?: string;
  subjectId?: string;
  lessonId?: string;
  documentType?: DocumentTypeValue;
  sort: SortValue;
  /** Page-based pagination (used by `/search`). Omit when using `take`/`skip` instead. */
  page?: number;
  /** Legacy offset-pagination (used by the homepage's "popular documents"). Set to bypass page-based pagination. */
  take?: number;
  skip?: number;
};

export type SearchDocumentsResult = {
  documents: DocumentRecord[];
  total: number;
  take: number;
  skip: number;
  /** Only present in page-based mode (`params.take` was not set). */
  page?: number;
  pageSize?: number;
  totalPages?: number;
  /**
   * Display names for any active gradeId/subjectId/lessonId filter — for
   * `/search`'s active-filter chips (UI-2), which need "Grade 11" not just
   * an id. Comes free from the taxonomy resolution this function already
   * does for the `where` clause; not a new query.
   */
  resolvedFilters: ResolvedTaxonomyFilters;
};

/**
 * Single source of truth for the Document search query — shared by
 * `GET /api/documents` and the Server Components that render search
 * results (`/`, `/search`), so both go through the exact same
 * where/orderBy/pagination logic instead of the page re-deriving it via a
 * self-fetch to its own API. Supports two pagination contracts: page-based
 * (`params.page`, capped at `SEARCH_PAGE_SIZE`) and legacy offset-based
 * (`params.take`/`params.skip`, used by the homepage and older callers).
 */
export async function searchDocuments(params: SearchDocumentsParams): Promise<SearchDocumentsResult> {
  const taxonomy = await resolveSearchTaxonomyFilters({
    gradeId: params.gradeId,
    subjectId: params.subjectId,
    lessonId: params.lessonId,
  });

  const usesLegacyPagination = params.take !== undefined;
  const take = usesLegacyPagination ? params.take! : SEARCH_PAGE_SIZE;
  const skip = usesLegacyPagination ? (params.skip ?? 0) : ((params.page ?? 1) - 1) * SEARCH_PAGE_SIZE;

  const where = {
    ...APPROVED_DOCUMENT_WHERE,
    ...(params.legacySubject ? { subject: { equals: params.legacySubject, mode: "insensitive" as const } } : {}),
    ...(taxonomy.gradeId ? { gradeId: taxonomy.gradeId } : {}),
    ...(taxonomy.subjectId ? { subjectId: taxonomy.subjectId } : {}),
    ...(taxonomy.lessonId ? { lessonId: taxonomy.lessonId } : {}),
    ...(params.documentType ? { documentType: params.documentType } : {}),
    ...(params.search
      ? {
          OR: [
            { title: { contains: params.search, mode: "insensitive" as const } },
            { description: { contains: params.search, mode: "insensitive" as const } },
            { subject: { contains: params.search, mode: "insensitive" as const } },
            { subjectRef: { name: { contains: params.search, mode: "insensitive" as const } } },
            { lesson: { name: { contains: params.search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: SORT_ORDER_BY[params.sort],
      take,
      skip,
      omit: { fileKey: true, reviewedById: true, rejectionReason: true },
      include: { grade: true, subjectRef: true, lesson: true },
    }),
    prisma.document.count({ where }),
  ]);

  const documents = rows.map(toDocumentRecord);

  if (usesLegacyPagination) {
    return { documents, total, take, skip, resolvedFilters: taxonomy };
  }

  return {
    documents,
    total,
    take,
    skip,
    page: params.page ?? 1,
    pageSize: SEARCH_PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / SEARCH_PAGE_SIZE)),
    resolvedFilters: taxonomy,
  };
}
