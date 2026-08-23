import { headers } from "next/headers";
import type { DocumentTypeValue } from "@/lib/documents/document-type";
import type { SortValue } from "@/lib/documents/search-query";
import type { DocumentRecord, GradeSummary, SubjectSummary } from "@/types/document";

type ApiEnvelope<T> = {
  success: boolean;
  data: T | null;
  error: string | null;
  meta?: { total: number; take: number; skip: number; page?: number; pageSize?: number; totalPages?: number };
};

async function getBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;

  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = headersList.get("x-forwarded-proto") ?? "http";
  return host ? `${protocol}://${host}` : "http://localhost:3000";
}

async function apiFetch<T>(path: string): Promise<ApiEnvelope<T>> {
  const baseUrl = await getBaseUrl();
  const response = await fetch(`${baseUrl}${path}`, { cache: "no-store" });
  const body = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || !body.success) {
    throw new Error(body.error ?? `Request to ${path} failed with status ${response.status}`);
  }

  return body;
}

export async function fetchDocuments(
  params: {
    search?: string;
    subject?: string;
    gradeId?: string;
    subjectId?: string;
    lessonId?: string;
    documentType?: DocumentTypeValue;
    sort?: SortValue;
    page?: number;
    take?: number;
  } = {}
): Promise<{ documents: DocumentRecord[]; total: number; page: number; pageSize: number; totalPages: number }> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.subject) query.set("subject", params.subject);
  if (params.gradeId) query.set("gradeId", params.gradeId);
  if (params.subjectId) query.set("subjectId", params.subjectId);
  if (params.lessonId) query.set("lessonId", params.lessonId);
  if (params.documentType) query.set("documentType", params.documentType);
  if (params.sort) query.set("sort", params.sort);
  if (params.page) query.set("page", String(params.page));
  if (params.take) query.set("take", String(params.take));

  const queryString = query.toString();
  const { data, meta } = await apiFetch<DocumentRecord[]>(
    `/api/documents${queryString ? `?${queryString}` : ""}`
  );

  return {
    documents: data ?? [],
    total: meta?.total ?? data?.length ?? 0,
    page: meta?.page ?? 1,
    pageSize: meta?.pageSize ?? data?.length ?? 0,
    totalPages: meta?.totalPages ?? 1,
  };
}

export async function fetchSubjects(): Promise<SubjectSummary[]> {
  const { data } = await apiFetch<SubjectSummary[]>("/api/subjects");
  return data ?? [];
}

/** Grades ordered by sortOrder — used to seed the initial Grade dropdown on /upload. */
export async function fetchGrades(): Promise<GradeSummary[]> {
  const { data } = await apiFetch<GradeSummary[]>("/api/grades");
  return data ?? [];
}

/** Returns null on a 404 (missing or invalid id) so callers can render a not-found state; throws on other failures. */
export async function fetchDocumentById(id: string): Promise<DocumentRecord | null> {
  const baseUrl = await getBaseUrl();
  const response = await fetch(`${baseUrl}/api/documents/${encodeURIComponent(id)}`, {
    cache: "no-store",
  });
  const body = (await response.json()) as ApiEnvelope<DocumentRecord>;

  if (response.status === 404) return null;

  if (!response.ok || !body.success) {
    throw new Error(body.error ?? `Request to /api/documents/${id} failed with status ${response.status}`);
  }

  return body.data;
}
