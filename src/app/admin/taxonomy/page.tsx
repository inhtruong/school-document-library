import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CreateTaxonomyDialog, TaxonomyRowActions } from "@/components/admin/TaxonomyCrudDialogs";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/authorize";
import { listGradeSummaries } from "@/lib/documents/grades";
import { listLessonsForSubject } from "@/lib/documents/lessons";
import { listSubjectsForGrade } from "@/lib/documents/subjects";

type TaxonomyPageProps = { searchParams: Promise<{ gradeId?: string; subjectId?: string }> };

/**
 * FEAT-15B: Server Component, URL is the single source of truth for which
 * Subject/Lesson section is expanded (`?gradeId=&subjectId=`) — same
 * principle as `/search` and the audit-log filters. Clicking "View
 * subjects"/"View lessons" is a plain navigation (no client state), so a
 * copied/bookmarked URL reproduces the exact same drill-down.
 */
export default async function TaxonomyPage({ searchParams }: TaxonomyPageProps) {
  await requireRole("ADMIN");

  const { gradeId, subjectId } = await searchParams;
  const t = await getTranslations("admin.taxonomy");

  const grades = await listGradeSummaries();
  const selectedGrade = gradeId ? grades.find((grade) => grade.id === gradeId) : undefined;
  const subjects = selectedGrade ? await listSubjectsForGrade(selectedGrade.id) : [];
  const selectedSubject = subjectId ? subjects.find((subject) => subject.id === subjectId) : undefined;
  const lessons = selectedSubject ? await listLessonsForSubject(selectedSubject.id) : [];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">{t("heading")}</h1>
        <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold tracking-tight text-ink">{t("gradesSectionTitle")}</h2>
          <CreateTaxonomyDialog entityLabel={t("gradeEntity")} apiPath="/api/grades" />
        </div>

        {grades.length === 0 ? (
          <p className="mt-4 text-sm text-muted">{t("noGrades")}</p>
        ) : (
          <TaxonomyTable
            columns={[t("nameColumn"), t("codeColumn"), t("sortOrderColumn"), t("documentsColumn")]}
            actionsColumnLabel={t("actionsColumn")}
            rows={grades.map((grade) => (
              <TaxonomyRow
                key={grade.id}
                highlighted={grade.id === gradeId}
                cells={[
                  <Link
                    key="name"
                    href={`/admin/taxonomy?gradeId=${grade.id}`}
                    className="font-medium text-ink hover:text-accent"
                  >
                    {grade.name}
                  </Link>,
                  grade.code,
                  grade.sortOrder,
                  grade.documentCount,
                ]}
                extraAction={
                  <Link
                    href={`/admin/taxonomy?gradeId=${grade.id}`}
                    className="text-xs font-medium text-accent hover:text-accent-strong"
                  >
                    {t("viewSubjects")}
                  </Link>
                }
                rowActions={
                  <TaxonomyRowActions entityLabel={t("gradeEntity")} apiPath={`/api/grades/${grade.id}`} row={grade} />
                }
              />
            ))}
          />
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold tracking-tight text-ink">
            {t("subjectsSectionTitle")}
            {selectedGrade ? <span className="ml-2 text-sm font-normal text-muted">— {selectedGrade.name}</span> : null}
          </h2>
          {selectedGrade ? (
            <CreateTaxonomyDialog
              entityLabel={t("subjectEntity")}
              apiPath="/api/subjects"
              extraFields={{ gradeId: selectedGrade.id }}
            />
          ) : null}
        </div>

        {!selectedGrade ? (
          <p className="mt-4 text-sm text-muted">{t("selectGradePrompt")}</p>
        ) : subjects.length === 0 ? (
          <p className="mt-4 text-sm text-muted">{t("noSubjects")}</p>
        ) : (
          <TaxonomyTable
            columns={[t("nameColumn"), t("codeColumn"), t("documentsColumn")]}
            actionsColumnLabel={t("actionsColumn")}
            rows={subjects.map((subject) => (
              <TaxonomyRow
                key={subject.id}
                highlighted={subject.id === subjectId}
                cells={[
                  <Link
                    key="name"
                    href={`/admin/taxonomy?gradeId=${selectedGrade.id}&subjectId=${subject.id}`}
                    className="font-medium text-ink hover:text-accent"
                  >
                    {subject.name}
                  </Link>,
                  subject.code,
                  subject.documentCount,
                ]}
                extraAction={
                  <Link
                    href={`/admin/taxonomy?gradeId=${selectedGrade.id}&subjectId=${subject.id}`}
                    className="text-xs font-medium text-accent hover:text-accent-strong"
                  >
                    {t("viewLessons")}
                  </Link>
                }
                rowActions={
                  <TaxonomyRowActions
                    entityLabel={t("subjectEntity")}
                    apiPath={`/api/subjects/${subject.id}`}
                    row={subject}
                  />
                }
              />
            ))}
          />
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold tracking-tight text-ink">
            {t("lessonsSectionTitle")}
            {selectedSubject ? <span className="ml-2 text-sm font-normal text-muted">— {selectedSubject.name}</span> : null}
          </h2>
          {selectedSubject ? (
            <CreateTaxonomyDialog
              entityLabel={t("lessonEntity")}
              apiPath="/api/lessons"
              extraFields={{ subjectId: selectedSubject.id }}
            />
          ) : null}
        </div>

        {!selectedSubject ? (
          <p className="mt-4 text-sm text-muted">{t("selectSubjectPrompt")}</p>
        ) : lessons.length === 0 ? (
          <p className="mt-4 text-sm text-muted">{t("noLessons")}</p>
        ) : (
          <TaxonomyTable
            columns={[t("nameColumn"), t("codeColumn"), t("documentsColumn")]}
            actionsColumnLabel={t("actionsColumn")}
            rows={lessons.map((lesson) => (
              <TaxonomyRow
                key={lesson.id}
                cells={[
                  <span key="name" className="font-medium text-ink">
                    {lesson.name}
                  </span>,
                  lesson.code,
                  lesson.documentCount,
                ]}
                rowActions={
                  <TaxonomyRowActions entityLabel={t("lessonEntity")} apiPath={`/api/lessons/${lesson.id}`} row={lesson} />
                }
              />
            ))}
          />
        )}
      </Card>
    </div>
  );
}

type TaxonomyTableProps = {
  columns: string[];
  rows: React.ReactNode[];
  actionsColumnLabel: string;
};

function TaxonomyTable({ columns, rows, actionsColumnLabel }: TaxonomyTableProps) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            {columns.map((column) => (
              <th key={column} className="pb-2 pr-3 font-medium">
                {column}
              </th>
            ))}
            <th className="pb-2 text-right font-medium">{actionsColumnLabel}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{rows}</tbody>
      </table>
    </div>
  );
}

type TaxonomyRowProps = {
  cells: React.ReactNode[];
  extraAction?: React.ReactNode;
  rowActions: React.ReactNode;
  highlighted?: boolean;
};

function TaxonomyRow({ cells, extraAction, rowActions, highlighted }: TaxonomyRowProps) {
  return (
    <tr className={highlighted ? "bg-accent-soft/40" : undefined}>
      {cells.map((cell, index) => (
        <td key={index} className="py-2.5 pr-3 text-muted">
          {cell}
        </td>
      ))}
      <td className="py-2.5">
        <div className="flex items-center justify-end gap-2">
          {extraAction}
          {rowActions}
        </div>
      </td>
    </tr>
  );
}
