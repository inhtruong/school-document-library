import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
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
    const search = searchParams.get("search")?.trim();
    const subject = searchParams.get("subject")?.trim();
    const take = parseTake(searchParams.get("take"));
    const skip = parseSkip(searchParams.get("skip"));

    const where = {
      ...(subject ? { subject: { equals: subject, mode: "insensitive" as const } } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" as const } },
              { description: { contains: search, mode: "insensitive" as const } },
              { subject: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip,
        omit: { fileKey: true },
        include: { grade: true, subjectRef: true, lesson: true },
      }),
      prisma.document.count({ where }),
    ]);

    return apiSuccess(documents, { meta: { total, take, skip } });
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
