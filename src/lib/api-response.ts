import { NextResponse } from "next/server";

export type ApiMeta = {
  total: number;
  take: number;
  skip: number;
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
