import { NextResponse } from "next/server";

export interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export function apiSuccess<T>(data: T, init?: ResponseInit, headers?: Record<string, string>): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    { ok: true, data },
    {
      status: 200,
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...headers,
        ...(init?.headers || {}),
      },
    }
  );
}

export function apiError(
  message: string,
  statusCode = 400,
  code = "BAD_REQUEST",
  details?: any
): NextResponse<ApiResponse<null>> {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
        details,
      },
    },
    { status: statusCode }
  );
}
