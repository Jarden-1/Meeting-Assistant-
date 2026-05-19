import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { CurrentUser } from './types';

export const CurrentUserParam = createParamDecorator((_data: unknown, context: ExecutionContext): CurrentUser => {
  const request = context.switchToHttp().getRequest<Request>();
  if (!request.user) {
    throw new UnauthorizedException('Missing current user');
  }
  return request.user;
});
