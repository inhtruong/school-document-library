import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { COMMENTS_PAGE_SIZE } from "@/lib/documents/comment-config";
import { createComment, listComments } from "@/lib/documents/comment";
import { prisma } from "@/lib/prisma";
import { COMMENT_RATE_LIMIT } from "@/lib/security/rate-limit-config";
import { checkRateLimit, tooManyRequestsResponse } from "@/lib/security/rate-limit";
import { commentContentSchema } from "@/lib/validation/comment";

type RouteContext = { params: Promise<{ id: string }> };

function parsePage(value: string | null): number {
  if (!value) return 1;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
}

/** Public — no auth required to read comments. Newest first, capped at COMMENTS_PAGE_SIZE. */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  try {
    const document = await prisma.document.findUnique({ where: { id }, select: { id: true } });
    if (!document) return apiError("Document not found", 404);

    const { searchParams } = new URL(request.url);
    const page = parsePage(searchParams.get("page"));
    const result = await listComments(id, page);

    return apiSuccess(result.comments, {
      meta: {
        total: result.total,
        take: COMMENTS_PAGE_SIZE,
        skip: (result.page - 1) * COMMENTS_PAGE_SIZE,
        page: result.page,
        pageSize: COMMENTS_PAGE_SIZE,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    console.error(`GET /api/documents/${id}/comments failed`, error);
    return apiError("Failed to load comments", 500);
  }
}

/** Requires any signed-in user — no role restriction. userId always comes from the session, never the body. */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) return apiError("Authentication required", 401);

  const rateLimit = checkRateLimit({ scope: "comment", identity: session.user.id, ...COMMENT_RATE_LIMIT });
  if (rateLimit.limited) return tooManyRequestsResponse(rateLimit.retryAfterSeconds);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Request body must be valid JSON", 400);
  }

  const parsed = commentContentSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid comment", 400);
  }

  try {
    const document = await prisma.document.findUnique({ where: { id }, select: { id: true } });
    if (!document) return apiError("Document not found", 404);

    const comment = await createComment(id, session.user.id, parsed.data.content);
    return apiSuccess(comment, { status: 201 });
  } catch (error) {
    console.error(`POST /api/documents/${id}/comments failed`, error);
    return apiError("Failed to save comment", 500);
  }
}
