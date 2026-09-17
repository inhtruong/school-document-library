"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { DOCUMENT_TYPE_VALUES, documentTypeMessageKey } from "@/lib/documents/document-type";
import { SORT_VALUES, sortMessageKey, type SortValue } from "@/lib/documents/search-query";

type Option = { id: string; name: string };

type SearchFiltersProps = {
  grades: Option[];
};

/**
 * UI-7A: restyled from stacked "label above a boxy select" blocks into a
 * flex-wrapping row of compact pill chips (closer to the reference demo's
 * filter-chip look). The label and the real, fully-functional `<select>`
 * now share ONE rounded pill, with the select itself borderless/
 * transparent so the pill's own border/background carry the visual
 * weight; `focus-within` on the pill highlights the whole chip. Still a
 * real, keyboard/screen-reader-native `<select>` — never a fake
 * non-functional button.
 */
const pillClassName =
  "inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-sm transition-colors focus-within:border-accent has-[:disabled]:opacity-50";
const selectClassName =
  "min-w-0 max-w-[9rem] truncate border-0 bg-transparent p-0 text-sm font-medium text-ink outline-none disabled:cursor-not-allowed sm:max-w-[11rem]";

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
  const tCommon = useTranslations("common");
  const tSearch = useTranslations("search");
  const tDocumentType = useTranslations("documentType");
  const tSort = useTranslations("sort");

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
    <div className="flex flex-1 flex-wrap items-center gap-2">
      <label className={pillClassName} htmlFor="filter-grade">
        <span className="text-muted">{tCommon("grade")}:</span>
        <select
          id="filter-grade"
          value={gradeId}
          onChange={(event) =>
            pushQuery({ gradeId: event.target.value, subjectId: undefined, lessonId: undefined })
          }
          className={selectClassName}
        >
          <option value="">{tSearch("allGrades")}</option>
          {grades.map((grade) => (
            <option key={grade.id} value={grade.id}>
              {grade.name}
            </option>
          ))}
        </select>
      </label>

      <label className={pillClassName} htmlFor="filter-subject">
        <span className="text-muted">{tCommon("subject")}:</span>
        <select
          id="filter-subject"
          value={subjectId}
          disabled={!gradeId || subjectsLoading}
          onChange={(event) => pushQuery({ subjectId: event.target.value, lessonId: undefined })}
          className={selectClassName}
        >
          <option value="">{subjectsLoading ? tCommon("loading") : tSearch("allSubjects")}</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </select>
      </label>
      {subjectsError ? <span className="text-xs text-destructive">{tSearch("subjectsLoadError")}</span> : null}

      <label className={pillClassName} htmlFor="filter-lesson">
        <span className="text-muted">{tCommon("lessonTopic")}:</span>
        <select
          id="filter-lesson"
          value={lessonId}
          disabled={!subjectId || lessonsLoading}
          onChange={(event) => pushQuery({ lessonId: event.target.value })}
          className={selectClassName}
        >
          <option value="">{lessonsLoading ? tCommon("loading") : tSearch("allLessons")}</option>
          {lessons.map((lesson) => (
            <option key={lesson.id} value={lesson.id}>
              {lesson.name}
            </option>
          ))}
        </select>
      </label>
      {lessonsError ? <span className="text-xs text-destructive">{tSearch("lessonsLoadError")}</span> : null}

      <label className={pillClassName} htmlFor="filter-documentType">
        <span className="text-muted">{tCommon("documentType")}:</span>
        <select
          id="filter-documentType"
          value={documentType}
          onChange={(event) => pushQuery({ documentType: event.target.value })}
          className={selectClassName}
        >
          <option value="">{tSearch("allTypes")}</option>
          {DOCUMENT_TYPE_VALUES.map((value) => (
            <option key={value} value={value}>
              {tDocumentType(documentTypeMessageKey(value))}
            </option>
          ))}
        </select>
      </label>

      <label className={pillClassName} htmlFor="filter-sort">
        <span className="text-muted">{tCommon("sort")}:</span>
        <select
          id="filter-sort"
          value={sort}
          onChange={(event) => pushQuery({ sort: event.target.value })}
          className={selectClassName}
        >
          {SORT_VALUES.map((value) => (
            <option key={value} value={value}>
              {tSort(sortMessageKey(value))}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
