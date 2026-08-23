import type { NextRequest } from "next/server";
import { apiError, apiSuccess, type ApiMeta } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { resolveSearchTaxonomyFilters } from "@/lib/documents/search-filters";
import { SEARCH_PAGE_SIZE, SORT_ORDER_BY, parseSearchQuery } from "@/lib/documents/search-query";
import { createDocumentSchema } from "@/lib/validation/document";

const DEFAULT_TAKE = 20;
const MAX_TAKE = 50;

function parseTake(value: string | null): number {
  const parsed = value ? Number(value) : DEFAULT_TAKE;
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TAKE;
  return Math.min(parsed, MAX_TAKE);
}

function parseSkip(value: string | null): number {
  const parsed = value ? Number(value) : 0;
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = parseSearchQuery(searchParams);
    const legacySubject = searchParams.get("subject")?.trim();

    const taxonomy = await resolveSearchTaxonomyFilters({
      gradeId: query.gradeId,
      subjectId: query.subjectId,
      lessonId: query.lessonId,
    });

    // `?take=` (the homepage's "popular documents" call, and older tests) keeps its
    // original offset-pagination contract; everything else uses the centralized
    // search page size and page-based pagination from the parsed query.
    const usesLegacyPagination = searchParams.has("take");
    const take = usesLegacyPagination ? parseTake(searchParams.get("take")) : SEARCH_PAGE_SIZE;
    const skip = usesLegacyPagination
      ? parseSkip(searchParams.get("skip"))
      : (query.page - 1) * SEARCH_PAGE_SIZE;

    const where = {
      ...(legacySubject ? { subject: { equals: legacySubject, mode: "insensitive" as const } } : {}),
      ...(taxonomy.gradeId ? { gradeId: taxonomy.gradeId } : {}),
      ...(taxonomy.subjectId ? { subjectId: taxonomy.subjectId } : {}),
      ...(taxonomy.lessonId ? { lessonId: taxonomy.lessonId } : {}),
      ...(query.documentType ? { documentType: query.documentType } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: "insensitive" as const } },
              { description: { contains: query.search, mode: "insensitive" as const } },
              { subject: { contains: query.search, mode: "insensitive" as const } },
              { subjectRef: { name: { contains: query.search, mode: "insensitive" as const } } },
              { lesson: { name: { contains: query.search, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    };

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        orderBy: SORT_ORDER_BY[query.sort],
        take,
        skip,
        omit: { fileKey: true },
        include: { grade: true, subjectRef: true, lesson: true },
      }),
      prisma.document.count({ where }),
    ]);

    const meta: ApiMeta = usesLegacyPagination
      ? { total, take, skip }
      : {
          total,
          take,
          skip,
          page: query.page,
          pageSize: SEARCH_PAGE_SIZE,
          totalPages: Math.max(1, Math.ceil(total / SEARCH_PAGE_SIZE)),
        };

    return apiSuccess(documents, { meta });
  } catch (error) {
    console.error("GET /api/documents failed", error);
    return apiError("Failed to load documents", 500);
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Request body must be valid JSON", 400);
  }

  const parsed = createDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid document data", 400);
  }

  try {
    const document = await prisma.document.create({ data: parsed.data, omit: { fileKey: true } });
    return apiSuccess(document, { status: 201 });
  } catch (error) {
    console.error("POST /api/documents failed", error);
    return apiError("Failed to create document", 500);
  }
}
