"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPE_VALUES } from "@/lib/documents/document-type";
import { SORT_LABELS, SORT_VALUES, type SortValue } from "@/lib/documents/search-query";

type Option = { id: string; name: string };

type SearchFiltersProps = {
  grades: Option[];
};

const selectClassName =
  "h-10 rounded-xl border border-line bg-card px-3 text-sm text-ink outline-none transition-colors hover:border-ink/20 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50";
const labelClassName = "flex flex-col gap-1.5 text-sm font-medium text-ink";

/**
 * Grade → Subject → Lesson/Topic cascading filters, plus Document Type and
 * Sort — all driven directly by the URL (`useSearchParams`), which stays the
 * single source of truth. Unlike `TaxonomySelectFields` (an uncontrolled
 * upload form that always starts blank), this must hydrate correctly from a
 * shared/reloaded URL, so each `<select>` is fully controlled and every
 * change pushes a new URL rather than managing its own committed state.
 */
export function SearchFilters({ grades }: SearchFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const gradeId = searchParams.get("gradeId") ?? "";
  const subjectId = searchParams.get("subjectId") ?? "";
  const lessonId = searchParams.get("lessonId") ?? "";
  const documentType = searchParams.get("documentType") ?? "";
  const rawSort = searchParams.get("sort") ?? "";
  const sort: SortValue = (SORT_VALUES as readonly string[]).includes(rawSort)
    ? (rawSort as SortValue)
    : "newest";

  const [subjects, setSubjects] = useState<Option[]>([]);
  const [lessons, setLessons] = useState<Option[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [subjectsError, setSubjectsError] = useState(false);
  const [lessonsError, setLessonsError] = useState(false);

  useEffect(() => {
    setSubjects([]);
    setSubjectsError(false);
    if (!gradeId) return;

    let cancelled = false;
    setSubjectsLoading(true);
    fetch(`/api/subjects?gradeId=${encodeURIComponent(gradeId)}`)
      .then((res) => res.json())
      .then((body) => {
        if (cancelled) return;
        if (!body.success) throw new Error(body.error ?? "Failed to load subjects");
        setSubjects(body.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setSubjectsError(true);
      })
      .finally(() => {
        if (!cancelled) setSubjectsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [gradeId]);

  useEffect(() => {
    setLessons([]);
    setLessonsError(false);
    if (!subjectId) return;

    let cancelled = false;
    setLessonsLoading(true);
    fetch(`/api/lessons?subjectId=${encodeURIComponent(subjectId)}`)
      .then((res) => res.json())
      .then((body) => {
        if (cancelled) return;
        if (!body.success) throw new Error(body.error ?? "Failed to load lessons");
        setLessons(body.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setLessonsError(true);
      })
      .finally(() => {
        if (!cancelled) setLessonsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [subjectId]);

  function pushQuery(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    const queryString = params.toString();
    router.push(queryString ? `/search?${queryString}` : "/search");
  }

  return (
    <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:items-end">
      <label className={labelClassName} htmlFor="filter-grade">
        Grade
        <select
          id="filter-grade"
          value={gradeId}
          onChange={(event) =>
            pushQuery({ gradeId: event.target.value, subjectId: undefined, lessonId: undefined })
          }
          className={selectClassName}
        >
          <option value="">All grades</option>
          {grades.map((grade) => (
            <option key={grade.id} value={grade.id}>
              {grade.name}
            </option>
          ))}
        </select>
      </label>

      <label className={labelClassName} htmlFor="filter-subject">
        Subject
        <select
          id="filter-subject"
          value={subjectId}
          disabled={!gradeId || subjectsLoading}
          onChange={(event) => pushQuery({ subjectId: event.target.value, lessonId: undefined })}
          className={selectClassName}
        >
          <option value="">{subjectsLoading ? "Loading…" : "All subjects"}</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </select>
        {subjectsError ? (
          <span className="text-xs text-destructive">Couldn&apos;t load subjects.</span>
        ) : null}
      </label>

      <label className={labelClassName} htmlFor="filter-lesson">
        Lesson / Topic
        <select
          id="filter-lesson"
          value={lessonId}
          disabled={!subjectId || lessonsLoading}
          onChange={(event) => pushQuery({ lessonId: event.target.value })}
          className={selectClassName}
        >
          <option value="">{lessonsLoading ? "Loading…" : "All lessons"}</option>
          {lessons.map((lesson) => (
            <option key={lesson.id} value={lesson.id}>
              {lesson.name}
            </option>
          ))}
        </select>
        {lessonsError ? (
          <span className="text-xs text-destructive">Couldn&apos;t load lessons.</span>
        ) : null}
      </label>

      <label className={labelClassName} htmlFor="filter-documentType">
        Document type
        <select
          id="filter-documentType"
          value={documentType}
          onChange={(event) => pushQuery({ documentType: event.target.value })}
          className={selectClassName}
        >
          <option value="">All types</option>
          {DOCUMENT_TYPE_VALUES.map((value) => (
            <option key={value} value={value}>
              {DOCUMENT_TYPE_LABELS[value]}
            </option>
          ))}
        </select>
      </label>

      <label className={labelClassName} htmlFor="filter-sort">
        Sort
        <select
          id="filter-sort"
          value={sort}
          onChange={(event) => pushQuery({ sort: event.target.value })}
          className={selectClassName}
        >
          {SORT_VALUES.map((value) => (
            <option key={value} value={value}>
              {SORT_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
