import Link from "next/link";
import DocumentCard from "@/components/DocumentCard";
import SearchBar from "@/components/SearchBar";
import { SearchFilters } from "@/components/SearchFilters";
import { fetchDocuments, fetchGrades } from "@/lib/api-client";
import { parseSearchQuery } from "@/lib/documents/search-query";

type SearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function toURLSearchParams(raw: Record<string, string | string[] | undefined>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value) && value[0]) params.set(key, value[0]);
  }
  return params;
}

function hrefForPage(currentParams: URLSearchParams, page: number): string {
  const params = new URLSearchParams(currentParams.toString());
  if (page > 1) params.set("page", String(page));
  else params.delete("page");
  const queryString = params.toString();
  return queryString ? `/search?${queryString}` : "/search";
}

export default async function SearchPage({ searchParams: searchParamsPromise }: SearchPageProps) {
  const rawParams = await searchParamsPromise;
  const currentParams = toURLSearchParams(rawParams);
  const query = parseSearchQuery(currentParams);
  const legacySubject = typeof rawParams.subject === "string" ? rawParams.subject : undefined;

  const [{ documents: results, total, page, totalPages }, grades] = await Promise.all([
    fetchDocuments({
      search: query.search,
      subject: legacySubject,
      gradeId: query.gradeId,
      subjectId: query.subjectId,
      lessonId: query.lessonId,
      documentType: query.documentType,
      sort: query.sort,
      page: query.page,
    }),
    fetchGrades(),
  ]);

  const clearFiltersHref = query.search ? `/search?q=${encodeURIComponent(query.search)}` : "/search";
  const hasActiveFilters = Boolean(
    query.gradeId || query.subjectId || query.lessonId || query.documentType || legacySubject
  );

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 sm:py-10">
      <div className="max-w-2xl">
        <SearchBar defaultValue={query.search ?? ""} size="compact" />
      </div>

      <div className="mt-8 flex flex-wrap items-baseline gap-x-2">
        <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
          {total} {total === 1 ? "document" : "documents"}
        </h1>
        {query.search ? <p className="text-muted">for &ldquo;{query.search}&rdquo;</p> : null}
        {legacySubject ? <p className="text-muted">in {legacySubject}</p> : null}
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <SearchFilters grades={grades} />
        {hasActiveFilters ? (
          <Link
            href={clearFiltersHref}
            className="flex h-10 items-center text-sm text-muted underline-offset-2 hover:text-ink hover:underline"
          >
            Clear filters
          </Link>
        ) : null}
      </div>

      {results.length > 0 ? (
        <>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {results.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} />
            ))}
          </div>

          {totalPages > 1 ? (
            <nav aria-label="Pagination" className="mt-8 flex flex-wrap items-center justify-center gap-2">
              <Link
                href={hrefForPage(currentParams, page - 1)}
                aria-disabled={page <= 1}
                tabIndex={page <= 1 ? -1 : undefined}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  page <= 1
                    ? "pointer-events-none border-line text-muted/50"
                    : "border-line text-ink hover:border-ink/25"
                }`}
              >
                Previous
              </Link>

              {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                <Link
                  key={pageNumber}
                  href={hrefForPage(currentParams, pageNumber)}
                  aria-current={pageNumber === page ? "page" : undefined}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                    pageNumber === page
                      ? "border-ink bg-ink text-paper"
                      : "border-line text-ink hover:border-ink/25"
                  }`}
                >
                  {pageNumber}
                </Link>
              ))}

              <Link
                href={hrefForPage(currentParams, page + 1)}
                aria-disabled={page >= totalPages}
                tabIndex={page >= totalPages ? -1 : undefined}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  page >= totalPages
                    ? "pointer-events-none border-line text-muted/50"
                    : "border-line text-ink hover:border-ink/25"
                }`}
              >
                Next
              </Link>
            </nav>
          ) : null}
        </>
      ) : (
        <div className="mt-6 rounded-xl border border-dashed border-line bg-surface p-8 text-center">
          <p className="font-display text-base font-medium">No documents found for these filters.</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Try a different keyword, or clear filters to see all documents.
          </p>
          <Link
            href="/search"
            className="mt-5 inline-block rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent"
          >
            Show all documents
          </Link>
        </div>
      )}
    </div>
  );
}
