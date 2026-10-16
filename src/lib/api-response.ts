import { NextResponse } from 'next/server';
import { ApiResponse } from '@/types';

export function successResponse<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    error: null,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
    }
  }, { status });
}

export function errorResponse(code: string, message: string, status = 400): NextResponse<ApiResponse<null>> {
  return NextResponse.json({
    success: false,
    data: null,
    error: {
      code,
      message,
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
    }
  }, { status });
}
