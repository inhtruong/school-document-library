import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { apiError, apiSuccess, type ApiMeta } from "@/lib/api-response";
import { hasRole } from "@/lib/auth/authorize";
import { parseSearchQuery } from "@/lib/documents/search-query";
import { searchDocuments } from "@/lib/documents/search";
import { prisma } from "@/lib/prisma";
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

    // `?take=` (the homepage's "popular documents" call, and older tests) keeps its
    // original offset-pagination contract; everything else uses the centralized
    // search page size and page-based pagination from the parsed query.
    const usesLegacyPagination = searchParams.has("take");

    const result = await searchDocuments({
      search: query.search,
      legacySubject,
      gradeId: query.gradeId,
      subjectId: query.subjectId,
      lessonId: query.lessonId,
      documentType: query.documentType,
      sort: query.sort,
      page: usesLegacyPagination ? undefined : query.page,
      take: usesLegacyPagination ? parseTake(searchParams.get("take")) : undefined,
      skip: usesLegacyPagination ? parseSkip(searchParams.get("skip")) : undefined,
    });

    const meta: ApiMeta = usesLegacyPagination
      ? { total: result.total, take: result.take, skip: result.skip }
      : {
          total: result.total,
          take: result.take,
          skip: result.skip,
          page: result.page!,
          pageSize: result.pageSize!,
          totalPages: result.totalPages!,
        };

    return apiSuccess(result.documents, { meta });
  } catch (error) {
    console.error("GET /api/documents failed", error);
    return apiError("Failed to load documents", 500);
  }
}

/**
 * Legacy metadata-only creation path (predates the taxonomy-aware upload
 * flow in @/lib/documents/upload.ts — Step 6A). Kept for API compatibility,
 * but must enforce the same TEACHER/ADMIN boundary as document upload; it
 * had no authorization check at all until Step 13C, which is a bug, not
 * intended behavior — the UI never called this route unauthenticated.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return apiError("You must be signed in to create documents", 401);
  }
  if (!hasRole(session, ["TEACHER", "ADMIN"])) {
    return apiError("Only teachers and admins can create documents", 403);
  }

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
    // Same role-based moderation rule as the taxonomy-aware upload flow
    // (see uploadDocument()) — `parsed.data` can never carry
    // moderationStatus itself (createDocumentSchema doesn't define that
    // field, so zod strips it), but this legacy path still needs to set
    // the initial status explicitly rather than relying on the DB default.
    const moderationStatus = session.user.role === "ADMIN" ? "APPROVED" : "PENDING";
    const document = await prisma.document.create({
      data: { ...parsed.data, moderationStatus },
      omit: { fileKey: true },
    });
    return apiSuccess(document, { status: 201 });
  } catch (error) {
    console.error("POST /api/documents failed", error);
    return apiError("Failed to create document", 500);
  }
}
