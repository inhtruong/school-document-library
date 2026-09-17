import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, BookOpen, Presentation, Search, Upload } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import GradeCard from "@/components/GradeCard";
import LatestDocumentCard from "@/components/home/LatestDocumentCard";
import SubjectCard from "@/components/SubjectCard";
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
  const [tHome, tUpload] = await Promise.all([getTranslations("home"), getTranslations("upload")]);

  return (
    <>
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-5xl px-5 py-16 text-center sm:py-24">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted">{tHome("eyebrow")}</p>

          <h1 className="mx-auto mt-4 max-w-2xl font-display text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
            {tHome("heading")}
          </h1>

          <p className="mx-auto mt-3 max-w-xl text-base text-muted">{tHome("subtitle")}</p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/search" className={buttonVariants({ size: "lg", className: "gap-2" })}>
              <Search className="h-4 w-4" aria-hidden />
              {tHome("hero.findDocuments")}
            </Link>
            <Link href="/upload" className={buttonVariants({ variant: "outline", size: "lg", className: "gap-2" })}>
              <Upload className="h-4 w-4" aria-hidden />
              {tUpload("heading")}
            </Link>
          </div>

          <div className="mx-auto mt-10 grid max-w-md grid-cols-3 gap-6">
            <div>
              <p className="font-display text-2xl font-semibold text-ink sm:text-3xl">{total}</p>
              <p className="mt-1 text-xs text-muted">{tHome("stats.documents")}</p>
            </div>
            <div>
              <p className="font-display text-2xl font-semibold text-ink sm:text-3xl">{subjects.length}</p>
              <p className="mt-1 text-xs text-muted">{tHome("stats.subjects")}</p>
            </div>
            <div>
              <p className="font-display text-2xl font-semibold text-ink sm:text-3xl">{grades.length}</p>
              <p className="mt-1 text-xs text-muted">{tHome("stats.grades")}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-line">
        <div className="mx-auto max-w-5xl px-5 py-14 sm:py-20">
          <h2 className="text-center font-display text-xl font-semibold tracking-tight sm:text-2xl">
            {tHome("audience.heading")}
          </h2>

          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <Card className="flex flex-col p-6 sm:p-8">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft">
                <BookOpen className="h-6 w-6 text-accent" aria-hidden />
              </span>
              <h3 className="mt-4 text-center font-display text-lg font-medium text-ink">
                {tHome("audience.student.title")}
              </h3>
              <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-muted">
                <li>{tHome("audience.student.bullet1")}</li>
                <li>{tHome("audience.student.bullet2")}</li>
                <li>{tHome("audience.student.bullet3")}</li>
                <li>{tHome("audience.student.bullet4")}</li>
                <li>{tHome("audience.student.bullet5")}</li>
              </ul>
              <Link href="/search" className={buttonVariants({ className: "mt-6 w-full" })}>
                {tHome("audience.student.cta")}
              </Link>
            </Card>

            <Card className="flex flex-col p-6 sm:p-8">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-surface">
                <Presentation className="h-6 w-6 text-secondary-strong" aria-hidden />
              </span>
              <h3 className="mt-4 text-center font-display text-lg font-medium text-ink">
                {tHome("audience.teacher.title")}
              </h3>
              <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-muted">
                <li>{tHome("audience.teacher.bullet1")}</li>
                <li>{tHome("audience.teacher.bullet2")}</li>
                <li>{tHome("audience.teacher.bullet3")}</li>
                <li>{tHome("audience.teacher.bullet4")}</li>
              </ul>
              <Link href="/upload" className={buttonVariants({ className: "mt-6 w-full" })}>
                {tHome("audience.teacher.cta")}
              </Link>
            </Card>
          </div>
        </div>
      </section>

      {grades.length > 0 ? (
        <section className="border-b border-line">
          <div className="mx-auto max-w-5xl px-5 py-14 sm:py-16">
            <h2 className="font-display text-lg font-semibold tracking-tight sm:text-xl">
              {tHome("browseByGrade")}
            </h2>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {grades.map((grade) => (
                <GradeCard key={grade.id} grade={grade} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="border-b border-line">
        <div className="mx-auto max-w-5xl px-5 py-14 sm:py-16">
          <h2 className="font-display text-lg font-semibold tracking-tight sm:text-xl">
            {tHome("browseBySubject")}
          </h2>

          {subjects.length > 0 ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {subjects.map((subject) => (
                <SubjectCard key={subject.subject} subject={subject} />
              ))}
            </div>
          ) : (
            <p className="mt-5 text-sm text-muted">{tHome("noSubjectsYet")}</p>
          )}
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-5xl px-5 py-14 sm:py-16">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-semibold tracking-tight sm:text-xl">
              {tHome("latestDocuments")}
            </h2>
            {latestDocuments.length > 0 ? (
              <Link
                href="/search"
                className="inline-flex items-center gap-1 text-sm font-medium text-accent transition-colors hover:text-accent-strong"
              >
                {tHome("viewAllDocuments")}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            ) : null}
          </div>

          {latestDocuments.length > 0 ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {latestDocuments.map((doc) => (
                <LatestDocumentCard key={doc.id} doc={doc} />
              ))}
            </div>
          ) : (
            <p className="mt-5 text-sm text-muted">{tHome("noDocumentsYet")}</p>
          )}
        </div>
      </section>
    </>
  );
}
