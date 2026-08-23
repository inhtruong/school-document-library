import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import DocumentCard from "@/components/DocumentCard";
import { loginHrefFor } from "@/lib/auth/document-login-href";
import { listUserBookmarks } from "@/lib/documents/bookmark";

type SavedPageProps = {
  searchParams: Promise<{ page?: string }>;
};

function parsePage(value: string | undefined): number {
  if (!value) return 1;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
}

function hrefForPage(page: number): string {
  return page > 1 ? `/saved?page=${page}` : "/saved";
}

export default async function SavedPage({ searchParams }: SavedPageProps) {
  const session = await auth();
  if (!session?.user) redirect(loginHrefFor("/saved"));

  const { page: rawPage } = await searchParams;
  const page = parsePage(rawPage);

  const { documents, total, totalPages } = await listUserBookmarks(session.user.id, page);

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 sm:py-10">
      <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">Saved documents</h1>
      <p className="mt-1 text-sm text-muted">
        {total} {total === 1 ? "document" : "documents"}
      </p>

      {documents.length > 0 ? (
        <>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {documents.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} />
            ))}
          </div>

          {totalPages > 1 ? (
            <nav aria-label="Pagination" className="mt-8 flex flex-wrap items-center justify-center gap-2">
              <Link
                href={hrefForPage(page - 1)}
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
                  href={hrefForPage(pageNumber)}
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
                href={hrefForPage(page + 1)}
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
          <p className="font-display text-base font-medium">You haven&apos;t saved any documents yet.</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Browse the library and save documents you want to find again later.
          </p>
          <Link
            href="/search"
            className="mt-5 inline-block rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent"
          >
            Browse documents
          </Link>
        </div>
      )}
    </div>
  );
}
