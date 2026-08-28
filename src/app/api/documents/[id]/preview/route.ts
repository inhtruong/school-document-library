import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { apiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { resolvePreviewKind, STREAMABLE_PREVIEW_KINDS } from "@/lib/documents/preview-kind";
import { parseRangeHeader } from "@/lib/documents/preview-range";
import { isDocumentVisibleTo } from "@/lib/documents/visibility";
import { createLocalFileReadStream, statLocalFile } from "@/lib/storage/local-storage";
import type { DocumentRecord } from "@/types/document";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Public preview endpoint for APPROVED documents — no auth required in
 * that (common) case. A PENDING/REJECTED document additionally requires
 * the caller to be its uploader or an ADMIN (FEAT-10A); `auth()` is only
 * called when the document isn't APPROVED, so the public/common path
 * keeps its original zero-auth-check cost. Receives only a Document ID;
 * the stored `fileKey` is read server-side from Postgres and resolved
 * through `resolveStoragePath`'s containment check, so the client never
 * supplies or sees a filesystem path. Serves inline (no
 * `Content-Disposition: attachment`) — this is preview, not download.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  let document;
  try {
    document = await prisma.document.findUnique({
      where: { id },
      select: { fileKey: true, fileCategory: true, mimeType: true, moderationStatus: true, uploadedById: true },
    });
  } catch (error) {
    console.error(`GET /api/documents/${id}/preview failed to load document`, error);
    return apiError("Failed to load preview", 500);
  }

  if (!document) {
    return apiError("Document not found", 404);
  }
  if (document.moderationStatus !== "APPROVED") {
    const session = await auth();
    if (!isDocumentVisibleTo(document, session)) return apiError("Document not found", 404);
  }
  if (!document.fileKey || !document.fileCategory || !document.mimeType) {
    return apiError("No file available for this document", 404);
  }
  const kind = resolvePreviewKind(document.fileCategory as DocumentRecord["fileCategory"], document.mimeType);
  if (!STREAMABLE_PREVIEW_KINDS.has(kind)) {
    return apiError("Preview is not available for this file type", 415);
  }

  const info = await statLocalFile(document.fileKey);
  if (!info.exists) {
    return apiError("File is not available", 404);
  }

  const range = parseRangeHeader(request.headers.get("range"), info.size);
  if (range.type === "invalid") {
    return new NextResponse(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${info.size}`, "Accept-Ranges": "bytes" },
    });
  }

  const isPartial = range.type === "partial";
  const start = isPartial ? range.start : 0;
  const end = isPartial ? range.end : info.size - 1;

  let nodeStream: ReturnType<typeof createLocalFileReadStream>;
  try {
    nodeStream = createLocalFileReadStream(info.absolutePath, isPartial ? { start, end } : undefined);
  } catch (error) {
    console.error(`GET /api/documents/${id}/preview failed to open file`, error);
    return apiError("Failed to load preview", 500);
  }

  return new NextResponse(Readable.toWeb(nodeStream) as ReadableStream, {
    status: isPartial ? 206 : 200,
    headers: {
      "Content-Type": document.mimeType,
      "Content-Length": String(end - start + 1),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
      ...(isPartial ? { "Content-Range": `bytes ${start}-${end}/${info.size}` } : {}),
    },
  });
}
