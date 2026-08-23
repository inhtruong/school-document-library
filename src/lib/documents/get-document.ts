import "server-only";
import { prisma } from "@/lib/prisma";
import type { DocumentRecord } from "@/types/document";

/**
 * Fetches one Document with every relation the detail page needs
 * (uploader, grade, subject, lesson). Shared by `GET /api/documents/:id`
 * and the Document Detail Server Component, so the page no longer has to
 * self-fetch its own API route just to read one row. Returns `null` on a
 * missing/invalid id — callers render their own not-found state.
 */
export async function getDocumentById(id: string): Promise<DocumentRecord | null> {
  const document = await prisma.document.findUnique({
    where: { id },
    omit: { fileKey: true },
    include: {
      uploadedBy: { select: { id: true, name: true, role: true } },
      grade: true,
      subjectRef: true,
      lesson: true,
    },
  });
  if (!document) return null;

  return {
    ...document,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}
