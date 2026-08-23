import { headers } from "next/headers";
import type { DocumentRecord, GradeSummary, SubjectSummary } from "@/types/document";

type ApiEnvelope<T> = {
  success: boolean;
  data: T | null;
  error: string | null;
  meta?: { total: number; take: number; skip: number };
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
  params: { search?: string; subject?: string; take?: number } = {}
): Promise<{ documents: DocumentRecord[]; total: number }> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.subject) query.set("subject", params.subject);
  if (params.take) query.set("take", String(params.take));

  const queryString = query.toString();
  const { data, meta } = await apiFetch<DocumentRecord[]>(
    `/api/documents${queryString ? `?${queryString}` : ""}`
  );

  return { documents: data ?? [], total: meta?.total ?? data?.length ?? 0 };
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
