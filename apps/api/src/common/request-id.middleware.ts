import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction) {
    const requestId =
      request.header('x-request-id') ??
      `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);
    next();
  }
}
