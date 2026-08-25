import Link from "next/link";
import { SlidersHorizontal, X } from "lucide-react";
import DocumentCard from "@/components/DocumentCard";
import SearchBar from "@/components/SearchBar";
import { SearchFilters } from "@/components/SearchFilters";
import { getUploaderSummaries } from "@/lib/documents/document-uploaders";
import { DOCUMENT_TYPE_LABELS } from "@/lib/documents/document-type";
import { listGrades } from "@/lib/documents/grades";
import { searchDocuments } from "@/lib/documents/search";
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

/** Builds the "remove this one filter" href for an active-filter chip — drops the given keys, keeps everything else (including page reset, since the result set changes). */
function hrefWithoutFilter(currentParams: URLSearchParams, keys: string[]): string {
  const params = new URLSearchParams(currentParams.toString());
  for (const key of keys) params.delete(key);
  params.delete("page");
  const queryString = params.toString();
  return queryString ? `/search?${queryString}` : "/search";
}

type ActiveFilterChip = { key: string; label: string; removeHref: string };

export default async function SearchPage({ searchParams: searchParamsPromise }: SearchPageProps) {
  const rawParams = await searchParamsPromise;
  const currentParams = toURLSearchParams(rawParams);
  const query = parseSearchQuery(currentParams);
  const legacySubject = typeof rawParams.subject === "string" ? rawParams.subject : undefined;

  const [searchResult, grades] = await Promise.all([
    searchDocuments({
      search: query.search,
      legacySubject,
      gradeId: query.gradeId,
      subjectId: query.subjectId,
      lessonId: query.lessonId,
      documentType: query.documentType,
      sort: query.sort,
      page: query.page,
    }),
    listGrades(),
  ]);
  const { documents: results, total, page = query.page, totalPages = 1, resolvedFilters } = searchResult;

  // One batched lookup for the whole page of results — never one query per
  // card (see document-uploaders.ts).
  const uploaderByDocumentId = await getUploaderSummaries(results.map((doc) => doc.id));

  const clearFiltersHref = query.search ? `/search?q=${encodeURIComponent(query.search)}` : "/search";

  const activeFilters: ActiveFilterChip[] = [];
  if (resolvedFilters.gradeName) {
    activeFilters.push({
      key: "grade",
      label: resolvedFilters.gradeName,
      removeHref: hrefWithoutFilter(currentParams, ["gradeId", "subjectId", "lessonId"]),
    });
  }
  if (resolvedFilters.subjectName) {
    activeFilters.push({
      key: "subject",
      label: resolvedFilters.subjectName,
      removeHref: hrefWithoutFilter(currentParams, ["subjectId", "lessonId"]),
    });
  }
  if (resolvedFilters.lessonName) {
    activeFilters.push({
      key: "lesson",
      label: resolvedFilters.lessonName,
      removeHref: hrefWithoutFilter(currentParams, ["lessonId"]),
    });
  }
  if (query.documentType) {
    activeFilters.push({
      key: "documentType",
      label: DOCUMENT_TYPE_LABELS[query.documentType],
      removeHref: hrefWithoutFilter(currentParams, ["documentType"]),
    });
  }
  if (legacySubject) {
    activeFilters.push({
      key: "legacySubject",
      label: legacySubject,
      removeHref: hrefWithoutFilter(currentParams, ["subject"]),
    });
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 sm:py-10">
      <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
        Search documents
      </h1>

      <div className="mt-5 max-w-2xl">
        <SearchBar defaultValue={query.search ?? ""} size="compact" />
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-x-3 gap-y-2">
        <span className="mb-2 hidden shrink-0 items-center gap-1.5 text-sm font-medium text-muted sm:flex">
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          Filters
        </span>
        <SearchFilters grades={grades} />
      </div>

      {activeFilters.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {activeFilters.map((filter) => (
            <Link
              key={filter.key}
              href={filter.removeHref}
              className="inline-flex items-center gap-1 rounded-full border border-line bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent transition-colors hover:border-accent"
            >
              {filter.label}
              <X className="h-3 w-3" aria-hidden />
              <span className="sr-only">Remove filter</span>
            </Link>
          ))}
          <Link
            href={clearFiltersHref}
            className="text-xs font-medium text-muted underline-offset-2 hover:text-ink hover:underline"
          >
            Clear all
          </Link>
        </div>
      ) : null}

      <div className="mt-8 flex flex-wrap items-baseline gap-x-2 border-t border-line pt-6">
        <p className="font-display text-lg font-semibold tracking-tight text-ink">
          {total} {total === 1 ? "document" : "documents"}
        </p>
        {query.search ? <p className="text-sm text-muted">for &ldquo;{query.search}&rdquo;</p> : null}
      </div>

      {results.length > 0 ? (
        <>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {results.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} uploader={uploaderByDocumentId.get(doc.id)} />
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
                      ? "border-accent bg-accent text-paper"
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
        <div className="mt-5 rounded-xl border border-dashed border-line bg-surface p-8 text-center sm:p-10">
          <p className="font-display text-base font-medium text-ink">No documents found</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">Try:</p>
          <ul className="mx-auto mt-1 max-w-sm list-inside list-disc text-left text-sm text-muted sm:text-center sm:list-none">
            <li>removing some filters</li>
            <li>using a broader keyword</li>
          </ul>
          <Link
            href="/search"
            className="mt-5 inline-flex h-10 items-center rounded-xl bg-accent px-4 text-sm font-medium text-paper transition-colors hover:bg-accent-strong"
          >
            Clear filters
          </Link>
        </div>
      )}
    </div>
  );
}
