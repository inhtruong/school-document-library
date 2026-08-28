import "server-only";
import { prisma } from "@/lib/prisma";
import { APPROVED_DOCUMENT_WHERE } from "@/lib/documents/visibility";
import type { SubjectSummary } from "@/types/document";

/**
 * Legacy `Document.subject` text grouping with counts — powers the
 * homepage/search "browse by subject" cards. Left on the legacy free-text
 * field (not the taxonomy `Subject` model) because it's kept in sync
 * automatically from the taxonomy Subject's name on new uploads (see
 * `uploadDocument()`), so this stays accurate for both legacy and
 * taxonomy-backed documents without a redesign. Shared by
 * `GET /api/subjects` (no `?gradeId=`) and the homepage Server Component.
 */
export async function listSubjectSummaries(): Promise<SubjectSummary[]> {
  const grouped = await prisma.document.groupBy({
    by: ["subject"],
    where: APPROVED_DOCUMENT_WHERE,
    _count: { _all: true },
    orderBy: { subject: "asc" },
  });

  return grouped.map((group) => ({
    subject: group.subject,
    count: group._count._all,
  }));
}
