import { type NextFunction, type Request, type Response } from 'express';
import { verifyToken } from '../utils/jwt/jwt.js';

export const authorizer = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(403).json({ ok: false, message: 'FORBIDDEN' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    res.status(403).json({ ok: false, message: 'FORBIDDEN' });
    return;
  }

  try {
    const payload = verifyToken(token);
    if (payload) {
      (req as any).user = payload;
      next();
    } else {
      res.status(401).json({ ok: false, message: 'Unauthorized' });
    }
  } catch (error) {
    console.error('JWT authenticator', {
      error,
    });
    res.status(500).json({ ok: false, message: 'Internal Server Error' });
  }
};
