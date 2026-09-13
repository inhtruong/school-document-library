import { DOCUMENT_TYPE_VALUES, type DocumentTypeValue } from "@/lib/documents/document-type";

/** Centralized search results page size — change here to affect the whole search flow. */
export const SEARCH_PAGE_SIZE = 12;

export const SORT_VALUES = ["newest", "oldest", "title_asc", "title_desc"] as const;
export type SortValue = (typeof SORT_VALUES)[number];
export const DEFAULT_SORT: SortValue = "newest";

/** FEAT-13: the actual label text now lives in the locale message files (`sort.*` — see src/i18n/messages/*.json). */
const SORT_MESSAGE_KEYS: Record<SortValue, "newest" | "oldest" | "titleAsc" | "titleDesc"> = {
  newest: "newest",
  oldest: "oldest",
  title_asc: "titleAsc",
  title_desc: "titleDesc",
};

export function sortMessageKey(value: SortValue): "newest" | "oldest" | "titleAsc" | "titleDesc" {
  return SORT_MESSAGE_KEYS[value];
}

/** Explicit allowlist mapping — never pass a raw query value into Prisma `orderBy`. */
export const SORT_ORDER_BY: Record<SortValue, { createdAt: "asc" | "desc" } | { title: "asc" | "desc" }> = {
  newest: { createdAt: "desc" },
  oldest: { createdAt: "asc" },
  title_asc: { title: "asc" },
  title_desc: { title: "desc" },
};

export type ParsedSearchQuery = {
  search?: string;
  gradeId?: string;
  subjectId?: string;
  lessonId?: string;
  documentType?: DocumentTypeValue;
  sort: SortValue;
  page: number;
};

function normalizeParam(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseSort(value: string | null): SortValue {
  return (SORT_VALUES as readonly string[]).includes(value ?? "") ? (value as SortValue) : DEFAULT_SORT;
}

function parsePage(value: string | null): number {
  if (!value) return 1;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
}

function parseDocumentType(value: string | null): DocumentTypeValue | undefined {
  return (DOCUMENT_TYPE_VALUES as readonly string[]).includes(value ?? "")
    ? (value as DocumentTypeValue)
    : undefined;
}

/**
 * Parses raw search query parameters into a normalized, validated shape.
 * Pure — no DB access — so it's safe to reuse from both `/api/documents`
 * (where the keyword arrives as `search`) and `/search` (where it arrives
 * as `q`); this is the one place that translation happens.
 */
export function parseSearchQuery(params: URLSearchParams): ParsedSearchQuery {
  return {
    search: normalizeParam(params.get("search") ?? params.get("q")),
    gradeId: normalizeParam(params.get("gradeId")),
    subjectId: normalizeParam(params.get("subjectId")),
    lessonId: normalizeParam(params.get("lessonId")),
    documentType: parseDocumentType(params.get("documentType")),
    sort: parseSort(params.get("sort")),
    page: parsePage(params.get("page")),
  };
}
