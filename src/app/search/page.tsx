import Link from "next/link";
import DocumentCard from "@/components/DocumentCard";
import SearchBar from "@/components/SearchBar";
import { fetchDocuments, fetchSubjects } from "@/lib/api-client";

type SearchPageProps = {
  searchParams: Promise<{ q?: string; subject?: string }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q = "", subject = "" } = await searchParams;

  const [{ documents: results, total }, subjects] = await Promise.all([
    fetchDocuments({ search: q, subject: subject || undefined }),
    fetchSubjects(),
  ]);

  function hrefFor(nextSubject?: string) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (nextSubject) params.set("subject", nextSubject);
    const queryString = params.toString();
    return queryString ? `/search?${queryString}` : "/search";
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 sm:py-10">
      <div className="max-w-2xl">
        <SearchBar defaultValue={q} subject={subject || undefined} size="compact" />
      </div>

      <div className="mt-8 flex flex-wrap items-baseline gap-x-2">
        <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
          {total} {total === 1 ? "document" : "documents"}
        </h1>
        {q ? <p className="text-muted">for &ldquo;{q}&rdquo;</p> : null}
        {subject ? <p className="text-muted">in {subject}</p> : null}
      </div>

      <nav aria-label="Filter by subject" className="mt-5 flex flex-wrap gap-2">
        <Link
          href={hrefFor()}
          aria-current={subject ? undefined : "true"}
          className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
            subject
              ? "border-line text-muted hover:border-ink/25 hover:text-ink"
              : "border-ink bg-ink text-paper"
          }`}
        >
          All subjects
        </Link>

        {subjects.map((s) => {
          const isActive = subject === s.subject;
          return (
            <Link
              key={s.subject}
              href={hrefFor(s.subject)}
              aria-current={isActive ? "true" : undefined}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                isActive
                  ? "border-ink bg-ink text-paper"
                  : "border-line text-muted hover:border-ink/25 hover:text-ink"
              }`}
            >
              {s.subject}
            </Link>
          );
        })}
      </nav>

      {results.length > 0 ? (
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {results.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} />
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-dashed border-line bg-surface p-8 text-center">
          <p className="font-display text-base font-medium">Nothing matches this search.</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Try a subject name, a document type such as Cheatsheet, or a different keyword.
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
