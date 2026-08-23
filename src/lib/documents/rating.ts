import "server-only";
import { prisma } from "@/lib/prisma";

export type RatingSummary = {
  averageRating: number | null;
  ratingCount: number;
  currentUserRating: number | null;
};

/**
 * Aggregates a Document's ratings via Prisma/PostgreSQL `aggregate()` —
 * never loads individual rating rows into memory just to average them.
 * `averageRating` is `null` (not `0`) when there are no ratings yet, since
 * a real average can never be below 1 — `0`/`null` would otherwise be
 * ambiguous. When there's at least one rating, it's rounded to 1 decimal.
 *
 * Shared by the public `GET /api/documents/:id/ratings` route and the
 * Document Detail page's initial server-rendered summary — the page calls
 * this directly (with the session it already has) rather than fetching its
 * own API route, so no cookie-forwarding is needed for that internal call.
 */
export async function getRatingSummary(documentId: string, userId: string | null): Promise<RatingSummary> {
  // `$transaction([...])` (rather than `Promise.all([...])`) runs both reads
  // over a single connection instead of checking out two from the pool —
  // on a page that already issues several other independent queries in
  // parallel (see documents/[id]/page.tsx), that adds up under concurrent
  // traffic even though each individual query is cheap.
  const results = await prisma.$transaction([
    prisma.documentRating.aggregate({
      where: { documentId },
      _avg: { value: true },
      _count: { value: true },
    }),
    ...(userId
      ? [
          prisma.documentRating.findUnique({
            where: { documentId_userId: { documentId, userId } },
            select: { value: true },
          }),
        ]
      : []),
  ]);

  const aggregate = results[0];
  const currentRating = userId ? (results[1] as { value: number } | null) : null;
  const ratingCount = aggregate._count.value;
  const averageRating = ratingCount > 0 ? Math.round((aggregate._avg.value ?? 0) * 10) / 10 : null;

  return {
    averageRating,
    ratingCount,
    currentUserRating: currentRating?.value ?? null,
  };
}
