import type { Request } from '../types';

export const isAdmin = (req: Request) => {
  return req?.user?.role === 'admin';
};
