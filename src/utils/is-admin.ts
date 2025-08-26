import type { AuthRequest } from '../types.js';

export const isAdmin = (req: AuthRequest) => {
  return req?.user?.role === 'admin';
};
