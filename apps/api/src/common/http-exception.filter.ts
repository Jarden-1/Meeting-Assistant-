import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { getRequestId } from './api-response';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();

    const normalized = this.normalize(exception);
    response.status(normalized.status).json({
      error: {
        code: normalized.code,
        message: normalized.message,
        details: normalized.details ?? {},
      },
      requestId: getRequestId(request),
    });
  }

  private normalize(exception: unknown) {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const parsed =
        typeof body === 'string'
          ? { message: body }
          : typeof body === 'object' && body
            ? (body as Record<string, unknown>)
            : {};
      const message = this.pickMessage(parsed.message) ?? exception.message ?? 'Request failed';
      const code = this.mapHttpCode(status, message, parsed);
      return {
        status,
        code,
        message,
        details: parsed,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        code: 'DATABASE_ERROR',
        message: exception.message,
        details: { prismaCode: exception.code },
      };
    }

    if (exception instanceof Error) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'INTERNAL_ERROR',
        message: exception.message,
        details: {},
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      details: {},
    };
  }

  private pickMessage(message: unknown) {
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.filter((item): item is string => typeof item === 'string').join('; ');
    return null;
  }

  private mapHttpCode(status: number, message: string, details: Record<string, unknown>) {
    if (typeof details.message === 'string' && details.message === 'THREAD_NOT_FOUND') return 'THREAD_NOT_FOUND';
    if (typeof details.message === 'string' && details.message === 'SESSION_NOT_FOUND') return 'SESSION_NOT_FOUND';
    if (typeof details.message === 'string' && details.message === 'ACTION_ITEM_NOT_FOUND') return 'ACTION_ITEM_NOT_FOUND';

    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'VALIDATION_ERROR';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        if (message.includes('THREAD_NOT_FOUND')) return 'THREAD_NOT_FOUND';
        if (message.includes('SESSION_NOT_FOUND')) return 'SESSION_NOT_FOUND';
        if (message.includes('ACTION_ITEM_NOT_FOUND')) return 'ACTION_ITEM_NOT_FOUND';
        return 'NOT_FOUND';
      default:
        return 'INTERNAL_ERROR';
    }
  }
}
