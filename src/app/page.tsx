import Link from "next/link";
import { ArrowRight } from "lucide-react";
import DocumentCard from "@/components/DocumentCard";
import GradeCard from "@/components/GradeCard";
import SearchBar from "@/components/SearchBar";
import SubjectCard from "@/components/SubjectCard";
import { getUploaderSummaries } from "@/lib/documents/document-uploaders";
import { listGradeSummaries } from "@/lib/documents/grades";
import { searchDocuments } from "@/lib/documents/search";
import { DEFAULT_SORT } from "@/lib/documents/search-query";
import { listSubjectSummaries } from "@/lib/documents/subject-summary";

const LATEST_DOCUMENTS_COUNT = 6;

export default async function HomePage() {
  const [{ documents: latestDocuments, total }, subjects, grades] = await Promise.all([
    searchDocuments({ take: LATEST_DOCUMENTS_COUNT, sort: DEFAULT_SORT }),
    listSubjectSummaries(),
    listGradeSummaries(),
  ]);
  const uploaderByDocumentId = await getUploaderSummaries(latestDocuments.map((doc) => doc.id));

  return (
    <div className="mx-auto max-w-5xl px-5">
      <section className="py-14 sm:py-20">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted">
          School document library
        </p>

        <h1 className="mt-4 max-w-2xl font-display text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Find the notes, exams and cheatsheets from your courses.
        </h1>

        <p className="mt-3 max-w-xl text-base text-muted">
          Lecture notes, exercises, exams and reference material, organized by grade and subject.
        </p>

        <div className="mt-8 max-w-2xl">
          <SearchBar />
        </div>

        <p className="mt-3 text-sm text-muted">
          {total} {total === 1 ? "document" : "documents"} across {subjects.length}{" "}
          {subjects.length === 1 ? "subject" : "subjects"}
        </p>
      </section>

      {grades.length > 0 ? (
        <section className="border-t border-line py-10 sm:py-12">
          <h2 className="font-display text-lg font-semibold tracking-tight sm:text-xl">
            Browse by grade
          </h2>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {grades.map((grade) => (
              <GradeCard key={grade.id} grade={grade} />
            ))}
          </div>
        </section>
      ) : null}

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
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-semibold tracking-tight sm:text-xl">
            Latest documents
          </h2>
          {latestDocuments.length > 0 ? (
            <Link
              href="/search"
              className="inline-flex items-center gap-1 text-sm font-medium text-accent transition-colors hover:text-accent-strong"
            >
              View all documents
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : null}
        </div>

        {latestDocuments.length > 0 ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {latestDocuments.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} uploader={uploaderByDocumentId.get(doc.id)} />
            ))}
          </div>
        ) : (
          <p className="mt-5 text-sm text-muted">No documents yet.</p>
        )}
      </section>
    </div>
  );
}
