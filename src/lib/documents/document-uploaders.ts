import "server-only";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export type UploaderSummary = { id: string; name: string; role: Role };

/**
 * Batched uploader lookup for a list of document ids — ONE query
 * regardless of list size, never one query per card. Deliberately kept
 * separate from `searchDocuments()` (in search.ts): that function backs
 * the public `GET /api/documents` endpoint too, and adding `uploadedBy` to
 * its own query would change that API's response shape for every caller,
 * not just this page. This lives only where DocumentCard actually needs
 * uploader metadata (Homepage "Latest documents", `/search` results).
 */
export async function getUploaderSummaries(
  documentIds: string[]
): Promise<Map<string, UploaderSummary>> {
  if (documentIds.length === 0) return new Map();

  const rows = await prisma.document.findMany({
    where: { id: { in: documentIds } },
    select: { id: true, uploadedBy: { select: { id: true, name: true, role: true } } },
  });

  const map = new Map<string, UploaderSummary>();
  for (const row of rows) {
    if (row.uploadedBy) map.set(row.id, row.uploadedBy);
  }
  return map;
}
