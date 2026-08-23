import { NextResponse } from "next/server";

export type ApiMeta = {
  total: number;
  take: number;
  skip: number;
  /** Present only for page-based search results (`/api/documents` without a legacy `?take=`); absent for offset-based callers like the homepage. */
  page?: number;
  pageSize?: number;
  totalPages?: number;
  /** Present only for `/api/notifications` — the caller's total unread count, independent of the current page. */
  unreadCount?: number;
};

type SuccessBody<T> = {
  success: true;
  data: T;
  error: null;
  meta?: ApiMeta;
};

type ErrorBody = {
  success: false;
  data: null;
  error: string;
};

export function apiSuccess<T>(
  data: T,
  options?: { status?: number; meta?: ApiMeta }
) {
  const body: SuccessBody<T> = {
    success: true,
    data,
    error: null,
    ...(options?.meta ? { meta: options.meta } : {}),
  };
  return NextResponse.json(body, { status: options?.status ?? 200 });
}

export function apiError(message: string, status = 400) {
  const body: ErrorBody = { success: false, data: null, error: message };
  return NextResponse.json(body, { status });
}
