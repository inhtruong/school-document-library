"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import type { DocumentModerationStatus, DocumentSourceType } from "@prisma/client";
import { DOCUMENT_TYPE_VALUES, documentTypeMessageKey } from "@/lib/documents/document-type";

type Option = { id: string; name: string };

type AdminDocumentFiltersProps = { grades: Option[] };

const STATUS_VALUES: DocumentModerationStatus[] = ["PENDING", "APPROVED", "REJECTED"];
const SOURCE_TYPE_VALUES: DocumentSourceType[] = ["FILE", "YOUTUBE"];

const selectClassName =
  "h-10 rounded-xl border border-line bg-card px-3 text-sm text-ink outline-none transition-colors hover:border-ink/20 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50";
const labelClassName = "flex flex-col gap-1.5 text-sm font-medium text-ink";

/**
 * Same controlled/URL-driven cascading pattern as `SearchFilters.tsx`
 * (targets `/admin/documents` instead of `/search`), plus moderation-status
 * and source-type selects that the public search page doesn't need.
 */
export function AdminDocumentFilters({ grades }: AdminDocumentFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tCommon = useTranslations("common");
  const tFilters = useTranslations("admin.documents.filters");
  const tStatus = useTranslations("moderation.status");
  const tDocumentType = useTranslations("documentType");

  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "";
  const sourceType = searchParams.get("sourceType") ?? "";
  const documentType = searchParams.get("documentType") ?? "";
  const gradeId = searchParams.get("gradeId") ?? "";
  const subjectId = searchParams.get("subjectId") ?? "";
  const lessonId = searchParams.get("lessonId") ?? "";

  const [subjects, setSubjects] = useState<Option[]>([]);
  const [lessons, setLessons] = useState<Option[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [lessonsLoading, setLessonsLoading] = useState(false);

  useEffect(() => {
    setSubjects([]);
    if (!gradeId) return;

    let cancelled = false;
    setSubjectsLoading(true);
    fetch(`/api/subjects?gradeId=${encodeURIComponent(gradeId)}`)
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled && body.success) setSubjects(body.data ?? []);
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
    if (!subjectId) return;

    let cancelled = false;
    setLessonsLoading(true);
    fetch(`/api/lessons?subjectId=${encodeURIComponent(subjectId)}`)
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled && body.success) setLessons(body.data ?? []);
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
    router.push(queryString ? `/admin/documents?${queryString}` : "/admin/documents");
  }

  return (
    <form
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault();
        pushQuery({ search: (event.currentTarget.elements.namedItem("search") as HTMLInputElement).value });
      }}
    >
      <label className={labelClassName} htmlFor="admin-doc-filter-search">
        {tFilters("searchLabel")}
        <input
          id="admin-doc-filter-search"
          name="search"
          type="text"
          defaultValue={search}
          placeholder={tFilters("searchPlaceholder")}
          className="h-10 rounded-xl border border-line bg-card px-3 text-sm text-ink outline-none placeholder:text-muted focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent"
        />
      </label>

      <label className={labelClassName} htmlFor="admin-doc-filter-status">
        {tFilters("statusLabel")}
        <select
          id="admin-doc-filter-status"
          value={status}
          onChange={(event) => pushQuery({ status: event.target.value })}
          className={selectClassName}
        >
          <option value="">{tFilters("allStatuses")}</option>
          {STATUS_VALUES.map((value) => (
            <option key={value} value={value}>
              {tStatus(value.toLowerCase() as "pending" | "approved" | "rejected")}
            </option>
          ))}
        </select>
      </label>

      <label className={labelClassName} htmlFor="admin-doc-filter-source">
        {tFilters("sourceLabel")}
        <select
          id="admin-doc-filter-source"
          value={sourceType}
          onChange={(event) => pushQuery({ sourceType: event.target.value })}
          className={selectClassName}
        >
          <option value="">{tFilters("allSources")}</option>
          {SOURCE_TYPE_VALUES.map((value) => (
            <option key={value} value={value}>
              {tFilters(value === "FILE" ? "sourceFile" : "sourceYoutube")}
            </option>
          ))}
        </select>
      </label>

      <label className={labelClassName} htmlFor="admin-doc-filter-type">
        {tCommon("documentType")}
        <select
          id="admin-doc-filter-type"
          value={documentType}
          onChange={(event) => pushQuery({ documentType: event.target.value })}
          className={selectClassName}
        >
          <option value="">{tFilters("allTypes")}</option>
          {DOCUMENT_TYPE_VALUES.map((value) => (
            <option key={value} value={value}>
              {tDocumentType(documentTypeMessageKey(value))}
            </option>
          ))}
        </select>
      </label>

      <label className={labelClassName} htmlFor="admin-doc-filter-grade">
        {tCommon("grade")}
        <select
          id="admin-doc-filter-grade"
          value={gradeId}
          onChange={(event) => pushQuery({ gradeId: event.target.value, subjectId: undefined, lessonId: undefined })}
          className={selectClassName}
        >
          <option value="">{tFilters("allGrades")}</option>
          {grades.map((grade) => (
            <option key={grade.id} value={grade.id}>
              {grade.name}
            </option>
          ))}
        </select>
      </label>

      <label className={labelClassName} htmlFor="admin-doc-filter-subject">
        {tCommon("subject")}
        <select
          id="admin-doc-filter-subject"
          value={subjectId}
          disabled={!gradeId || subjectsLoading}
          onChange={(event) => pushQuery({ subjectId: event.target.value, lessonId: undefined })}
          className={selectClassName}
        >
          <option value="">{subjectsLoading ? tCommon("loading") : tFilters("allSubjects")}</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </select>
      </label>

      <label className={labelClassName} htmlFor="admin-doc-filter-lesson">
        {tCommon("lessonTopic")}
        <select
          id="admin-doc-filter-lesson"
          value={lessonId}
          disabled={!subjectId || lessonsLoading}
          onChange={(event) => pushQuery({ lessonId: event.target.value })}
          className={selectClassName}
        >
          <option value="">{lessonsLoading ? tCommon("loading") : tFilters("allLessons")}</option>
          {lessons.map((lesson) => (
            <option key={lesson.id} value={lesson.id}>
              {lesson.name}
            </option>
          ))}
        </select>
      </label>
    </form>
  );
}
