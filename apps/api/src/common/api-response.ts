import type { Request } from 'express';

export type ApiResponse<T> = {
  data: T;
  requestId: string;
};

export function ok<T>(data: T, request: Request): ApiResponse<T> {
  return {
    data,
    requestId: request.requestId ?? 'req_unknown',
  };
}

export function getRequestId(request: Request): string {
  return request.requestId ?? 'req_unknown';
}
