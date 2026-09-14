import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { apiErrorCode } from "@/lib/api-response";
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
      select: {
        fileKey: true,
        previewFileKey: true,
        fileCategory: true,
        mimeType: true,
        moderationStatus: true,
        uploadedById: true,
        sourceType: true,
      },
    });
  } catch (error) {
    console.error(`GET /api/documents/${id}/preview failed to load document`, error);
    return apiErrorCode("FAILED_LOAD_PREVIEW", 500);
  }

  if (!document) {
    return apiErrorCode("DOCUMENT_NOT_FOUND", 404);
  }
  if (document.moderationStatus !== "APPROVED") {
    const session = await auth();
    if (!isDocumentVisibleTo(document, session)) return apiErrorCode("DOCUMENT_NOT_FOUND", 404);
  }
  if (!document.fileKey || !document.fileCategory || !document.mimeType) {
    return apiErrorCode("NO_FILE_AVAILABLE", 404);
  }
  const kind = resolvePreviewKind(
    document.sourceType as DocumentRecord["sourceType"],
    document.fileCategory as DocumentRecord["fileCategory"],
    document.mimeType
  );
  if (!STREAMABLE_PREVIEW_KINDS.has(kind)) {
    return apiErrorCode("PREVIEW_UNSUPPORTED_FILE_TYPE", 415);
  }

  // FEAT-12A: a PowerPoint document's preview is the server-generated PDF
  // (previewFileKey), never the original .ppt/.pptx bytes — the original
  // is reserved for Download only. Every other category streams its own
  // fileKey/mimeType exactly as before this feature.
  const isConvertedPreview = document.fileCategory === "POWERPOINT";
  const streamKey = isConvertedPreview ? document.previewFileKey : document.fileKey;
  const streamMimeType = isConvertedPreview ? "application/pdf" : document.mimeType;
  if (!streamKey) {
    return apiErrorCode("NO_FILE_AVAILABLE", 404);
  }

  const info = await statLocalFile(streamKey);
  if (!info.exists) {
    return apiErrorCode("FILE_NOT_AVAILABLE", 404);
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
    return apiErrorCode("FAILED_LOAD_PREVIEW", 500);
  }

  return new NextResponse(Readable.toWeb(nodeStream) as ReadableStream, {
    status: isPartial ? 206 : 200,
    headers: {
      "Content-Type": streamMimeType,
      "Content-Length": String(end - start + 1),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
      ...(isPartial ? { "Content-Range": `bytes ${start}-${end}/${info.size}` } : {}),
    },
  });
}
