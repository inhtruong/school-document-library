import DocumentCard from "@/components/DocumentCard";
import SearchBar from "@/components/SearchBar";
import SubjectCard from "@/components/SubjectCard";
import { searchDocuments } from "@/lib/documents/search";
import { DEFAULT_SORT } from "@/lib/documents/search-query";
import { listSubjectSummaries } from "@/lib/documents/subject-summary";

export default async function HomePage() {
  const [{ documents: popularDocuments, total }, subjects] = await Promise.all([
    searchDocuments({ take: 4, sort: DEFAULT_SORT }),
    listSubjectSummaries(),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-5">
      <section className="py-14 sm:py-20">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
          School document library
        </p>

        <h1 className="mt-4 max-w-2xl font-display text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Find the notes, exams and cheatsheets from your courses.
        </h1>

        <div className="mt-8 max-w-2xl">
          <SearchBar />
        </div>

        <p className="mt-3 text-sm text-muted">
          {total} documents across {subjects.length} subjects.
        </p>
      </section>

      <section className="border-t border-line py-10 sm:py-12">
        <h2 className="font-display text-lg font-semibold tracking-tight sm:text-xl">
          Browse by subject
        </h2>

        {subjects.length > 0 ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {subjects.map((subject) => (
              <SubjectCard key={subject.subject} subject={subject} />
            ))}
          </div>
        ) : (
          <p className="mt-5 text-sm text-muted">No subjects yet.</p>
        )}
      </section>

      <section className="border-t border-line py-10 sm:py-12">
        <h2 className="font-display text-lg font-semibold tracking-tight sm:text-xl">
          Popular documents
        </h2>

        {popularDocuments.length > 0 ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {popularDocuments.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} />
            ))}
          </div>
        ) : (
          <p className="mt-5 text-sm text-muted">No documents yet.</p>
        )}
      </section>
    </div>
  );
}
