"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { DOCUMENT_TYPE_VALUES, documentTypeMessageKey } from "@/lib/documents/document-type";

type Option = { id: string; name: string };

type TaxonomySelectFieldsProps = {
  grades: Option[];
};

const selectClassName =
  "h-10 rounded-lg border border-line bg-paper px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Grade → Subject → Lesson cascading selectors, plus the Document Type
 * picker. Client-only (needs to fetch Subject/Lesson options as the parent
 * selection changes), but each <select> still has a plain `name` so its
 * value is submitted normally by the surrounding server-action <form> — no
 * client-side form state management needed beyond the two parent IDs.
 */
export function TaxonomySelectFields({ grades }: TaxonomySelectFieldsProps) {
  const tCommon = useTranslations("common");
  const tUpload = useTranslations("upload");
  const tDocumentType = useTranslations("documentType");
  const [gradeId, setGradeId] = useState("");
  const [subjectId, setSubjectId] = useState("");

  const [subjects, setSubjects] = useState<Option[]>([]);
  const [lessons, setLessons] = useState<Option[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [subjectsError, setSubjectsError] = useState(false);
  const [lessonsError, setLessonsError] = useState(false);

  useEffect(() => {
    setSubjectId("");
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

  return (
    <>
      <label className="flex flex-col gap-1.5 text-sm" htmlFor="upload-gradeId">
        {tCommon("grade")}
        <select
          id="upload-gradeId"
          name="gradeId"
          required
          value={gradeId}
          onChange={(event) => setGradeId(event.target.value)}
          className={selectClassName}
        >
          <option value="" disabled>
            {tUpload("selectGrade")}
          </option>
          {grades.map((grade) => (
            <option key={grade.id} value={grade.id}>
              {grade.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5 text-sm" htmlFor="upload-subjectId">
        {tCommon("subject")}
        {/* key={gradeId} guarantees a full reset (not just the option list) when Grade changes */}
        <select
          key={gradeId}
          id="upload-subjectId"
          name="subjectId"
          required
          disabled={!gradeId || subjectsLoading}
          value={subjectId}
          onChange={(event) => setSubjectId(event.target.value)}
          className={selectClassName}
        >
          <option value="" disabled>
            {!gradeId ? tUpload("selectGradeFirst") : subjectsLoading ? tCommon("loading") : tUpload("selectSubject")}
          </option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </select>
        {subjectsError ? (
          <span className="text-xs text-red-600">{tUpload("subjectsLoadError")}</span>
        ) : null}
      </label>

      <label className="flex flex-col gap-1.5 text-sm" htmlFor="upload-lessonId">
        {tCommon("lessonTopic")}
        {/* key={subjectId} guarantees a full reset when Subject changes */}
        <select
          key={subjectId}
          id="upload-lessonId"
          name="lessonId"
          required
          disabled={!subjectId || lessonsLoading}
          defaultValue=""
          className={selectClassName}
        >
          <option value="" disabled>
            {!subjectId ? tUpload("selectSubjectFirst") : lessonsLoading ? tCommon("loading") : tUpload("selectLesson")}
          </option>
          {lessons.map((lesson) => (
            <option key={lesson.id} value={lesson.id}>
              {lesson.name}
            </option>
          ))}
        </select>
        {lessonsError ? (
          <span className="text-xs text-red-600">{tUpload("lessonsLoadError")}</span>
        ) : null}
      </label>

      <label className="flex flex-col gap-1.5 text-sm" htmlFor="upload-documentType">
        {tCommon("documentType")}
        <select
          id="upload-documentType"
          name="documentType"
          required
          defaultValue=""
          className={selectClassName}
        >
          <option value="" disabled>
            {tUpload("selectDocumentType")}
          </option>
          {DOCUMENT_TYPE_VALUES.map((value) => (
            <option key={value} value={value}>
              {tDocumentType(documentTypeMessageKey(value))}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
