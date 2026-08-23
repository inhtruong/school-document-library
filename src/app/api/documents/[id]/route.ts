import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { updateDocumentSchema } from "@/lib/validation/document";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  try {
    const document = await prisma.document.findUnique({
      where: { id },
      omit: { fileKey: true },
      include: {
        uploadedBy: { select: { id: true, name: true } },
        grade: true,
        subjectRef: true,
        lesson: true,
      },
    });
    if (!document) return apiError("Document not found", 404);
    return apiSuccess(document);
  } catch (error) {
    console.error(`GET /api/documents/${id} failed`, error);
    return apiError("Failed to load document", 500);
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Request body must be valid JSON", 400);
  }

  const parsed = updateDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid document data", 400);
  }

  try {
    const existing = await prisma.document.findUnique({ where: { id } });
    if (!existing) return apiError("Document not found", 404);

    const document = await prisma.document.update({
      where: { id },
      data: parsed.data,
      omit: { fileKey: true },
    });
    return apiSuccess(document);
  } catch (error) {
    console.error(`PUT /api/documents/${id} failed`, error);
    return apiError("Failed to update document", 500);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  try {
    const existing = await prisma.document.findUnique({ where: { id } });
    if (!existing) return apiError("Document not found", 404);

    await prisma.document.delete({ where: { id } });
    return apiSuccess({ id });
  } catch (error) {
    console.error(`DELETE /api/documents/${id} failed`, error);
    return apiError("Failed to delete document", 500);
  }
}
