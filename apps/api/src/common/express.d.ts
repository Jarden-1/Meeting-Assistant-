import type { CurrentUser } from './types';

declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
    user?: CurrentUser;
  }
}
