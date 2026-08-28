import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { apiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { buildContentDisposition } from "@/lib/documents/content-disposition";
import { isDocumentVisibleTo } from "@/lib/documents/visibility";
import { createLocalFileReadStream, statLocalFile } from "@/lib/storage/local-storage";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Protected download endpoint — any authenticated user may download an
 * APPROVED document (STUDENT/TEACHER/ADMIN alike); guests get 401. A
 * PENDING/REJECTED document additionally requires the caller to be its
 * uploader or an ADMIN (FEAT-10A) — "authenticated" alone no longer
 * bypasses moderation. Unlike preview, this always serves as
 * `Content-Disposition: attachment` under the document's original
 * `fileName` (never the generated `fileKey`). Receives only a Document ID;
 * `fileKey` is read server-side and resolved through the same
 * containment-checked `statLocalFile`/`createLocalFileReadStream` helpers
 * the preview endpoint uses — no filesystem path ever comes from the client.
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) {
    return apiError("You must be signed in to download documents", 401);
  }

  let document;
  try {
    document = await prisma.document.findUnique({
      where: { id },
      select: { fileKey: true, fileName: true, mimeType: true, moderationStatus: true, uploadedById: true },
    });
  } catch (error) {
    console.error(`GET /api/documents/${id}/download failed to load document`, error);
    return apiError("Failed to download this document", 500);
  }

  if (!document) {
    return apiError("Document not found", 404);
  }
  if (!isDocumentVisibleTo(document, session)) {
    return apiError("Document not found", 404);
  }
  if (!document.fileKey || !document.mimeType) {
    return apiError("No file available for this document", 404);
  }

  const info = await statLocalFile(document.fileKey);
  if (!info.exists) {
    return apiError("The file is no longer available", 404);
  }

  let nodeStream: ReturnType<typeof createLocalFileReadStream>;
  try {
    nodeStream = createLocalFileReadStream(info.absolutePath);
  } catch (error) {
    console.error(`GET /api/documents/${id}/download failed to open file`, error);
    return apiError("Failed to download this document", 500);
  }

  return new NextResponse(Readable.toWeb(nodeStream) as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": document.mimeType,
      "Content-Length": String(info.size),
      "Content-Disposition": buildContentDisposition(document.fileName || "download"),
      "Cache-Control": "no-store",
    },
  });
}
