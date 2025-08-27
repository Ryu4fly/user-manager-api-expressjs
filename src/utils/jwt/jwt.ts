import jwt from 'jsonwebtoken';
import type { User } from '../../types.js';

const JWT_SIGNATURE = process.env.JWT_SIGNATURE;
if (!JWT_SIGNATURE) {
  throw new Error('JWT_SIGNATURE not defined in env file');
}
export const signAccessToken = ({ _id, email, role }: User) => {
  return jwt.sign({ id: _id, email, role }, JWT_SIGNATURE, {
    expiresIn: '15m',
  });
};

export const signRefreshToken = ({ _id, email, role }: User) => {
  return jwt.sign({ id: _id, email, role }, JWT_SIGNATURE, {
    expiresIn: '1h',
  });
};

export const verifyToken = (token: string) => {
  try {
    const decoded = jwt.verify(token, JWT_SIGNATURE);
    return decoded;
  } catch (error) {
    if (
      error instanceof jwt.JsonWebTokenError ||
      error instanceof jwt.TokenExpiredError
    ) {
      console.warn(error.message, { error });
      return undefined;
    }
    throw error;
  }
};
