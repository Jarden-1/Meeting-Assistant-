import type { CurrentUser } from './types';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      user?: CurrentUser;
    }
  }
}

export {};
