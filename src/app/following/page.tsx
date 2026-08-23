import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { FollowedLessonsList } from "@/components/FollowedLessonsList";
import { FollowedTeachersList } from "@/components/FollowedTeachersList";
import { loginHrefFor } from "@/lib/auth/document-login-href";
import { listFollowedLessons } from "@/lib/follow/lesson-follow";
import { listFollowedTeachers } from "@/lib/follow/teacher-follow";

type FollowingPageProps = {
  searchParams: Promise<{ teachersPage?: string; lessonsPage?: string }>;
};

function parsePage(value: string | undefined): number {
  if (!value) return 1;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
}

function hrefFor(teachersPage: number, lessonsPage: number): string {
  const params = new URLSearchParams();
  if (teachersPage > 1) params.set("teachersPage", String(teachersPage));
  if (lessonsPage > 1) params.set("lessonsPage", String(lessonsPage));
  const queryString = params.toString();
  return queryString ? `/following?${queryString}` : "/following";
}

const paginationLinkClassName =
  "rounded-lg border px-3 py-1.5 text-sm transition-colors border-line text-ink hover:border-ink/25";
const paginationDisabledClassName = "pointer-events-none border-line text-muted/50";

export default async function FollowingPage({ searchParams }: FollowingPageProps) {
  const session = await auth();
  if (!session?.user) redirect(loginHrefFor("/following"));

  const { teachersPage: rawTeachersPage, lessonsPage: rawLessonsPage } = await searchParams;
  const teachersPage = parsePage(rawTeachersPage);
  const lessonsPage = parsePage(rawLessonsPage);

  const [teachersResult, lessonsResult] = await Promise.all([
    listFollowedTeachers(session.user.id, teachersPage),
    listFollowedLessons(session.user.id, lessonsPage),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:py-10">
      <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">Following</h1>

      <section className="mt-8">
        <h2 className="font-display text-lg font-semibold tracking-tight">Teachers ({teachersResult.total})</h2>
        <div className="mt-4">
          <FollowedTeachersList initialTeachers={teachersResult.teachers} />
        </div>
        {teachersResult.totalPages > 1 ? (
          <nav aria-label="Teachers pagination" className="mt-4 flex items-center justify-center gap-2">
            <Link
              href={hrefFor(teachersPage - 1, lessonsPage)}
              aria-disabled={teachersPage <= 1}
              tabIndex={teachersPage <= 1 ? -1 : undefined}
              className={`${paginationLinkClassName} ${teachersPage <= 1 ? paginationDisabledClassName : ""}`}
            >
              Previous
            </Link>
            <span className="text-xs text-muted">
              Page {teachersPage} of {teachersResult.totalPages}
            </span>
            <Link
              href={hrefFor(teachersPage + 1, lessonsPage)}
              aria-disabled={teachersPage >= teachersResult.totalPages}
              tabIndex={teachersPage >= teachersResult.totalPages ? -1 : undefined}
              className={`${paginationLinkClassName} ${
                teachersPage >= teachersResult.totalPages ? paginationDisabledClassName : ""
              }`}
            >
              Next
            </Link>
          </nav>
        ) : null}
      </section>

      <section className="mt-10 border-t border-line pt-8">
        <h2 className="font-display text-lg font-semibold tracking-tight">Lessons ({lessonsResult.total})</h2>
        <div className="mt-4">
          <FollowedLessonsList initialLessons={lessonsResult.lessons} />
        </div>
        {lessonsResult.totalPages > 1 ? (
          <nav aria-label="Lessons pagination" className="mt-4 flex items-center justify-center gap-2">
            <Link
              href={hrefFor(teachersPage, lessonsPage - 1)}
              aria-disabled={lessonsPage <= 1}
              tabIndex={lessonsPage <= 1 ? -1 : undefined}
              className={`${paginationLinkClassName} ${lessonsPage <= 1 ? paginationDisabledClassName : ""}`}
            >
              Previous
            </Link>
            <span className="text-xs text-muted">
              Page {lessonsPage} of {lessonsResult.totalPages}
            </span>
            <Link
              href={hrefFor(teachersPage, lessonsPage + 1)}
              aria-disabled={lessonsPage >= lessonsResult.totalPages}
              tabIndex={lessonsPage >= lessonsResult.totalPages ? -1 : undefined}
              className={`${paginationLinkClassName} ${
                lessonsPage >= lessonsResult.totalPages ? paginationDisabledClassName : ""
              }`}
            >
              Next
            </Link>
          </nav>
        ) : null}
      </section>
    </div>
  );
}
