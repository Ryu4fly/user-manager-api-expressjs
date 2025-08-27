import type { Request } from '../types.js';

export const isAdmin = (req: Request) => {
  return req?.user?.role === 'admin';
};
