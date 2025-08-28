import bcrypt from 'bcrypt';
import { type Response } from 'express';
import z from 'zod';
import { usersDB } from '../services/couchDB';
import { LoginParams, RegisterParams, User, type Request } from '../types';
import { signAccessToken, signRefreshToken } from '../utils/jwt/jwt';
import { logger } from '../utils/logger';

export const registerHandler = async (req: Request, res: Response) => {
  const parsedBody = RegisterParams.safeParse(req.body);

  if (!parsedBody.success) {
    logger.warn('Register Validation failed', 'REGISTER', req, {
      cause: z.treeifyError(parsedBody.error),
    });
    res.status(400).json({
      ok: false,
      message: 'Validation failed',
    });
    return;
  }

  const { email, password } = parsedBody.data;

  const query = {
    selector: {
      email: {
        $eq: email,
      },
    },
  };
  const response = await usersDB.find(query);
  const user = response.docs[0];

  if (user) {
    logger.warn('User already exists', 'REGISTER', req);
    res.status(400).json({ ok: false, message: 'User already exists' });
    return;
  }

  try {
    const hashed = await bcrypt.hash(password, 10);
    const response = await usersDB.insert({
      email,
      password: hashed,
      role: 'USERS',
    });

    logger.info('User sucessfully created', 'REGISTER', req, {
      userID: response.id,
      resourceType: 'USERS',
      resourceId: response.id,
    });

    res.status(201).json({ ok: true, id: response.id });
  } catch (err) {
    logger.error(
      'Unhandled Exception: REGISTER failed to register user',
      'REGISTER',
      req,
      {
        cause: err,
      }
    );

    res.status(500).json({ ok: false, message: 'Unhandled Exception' });
  }
};

export const loginHandler = async (req: Request, res: Response) => {
  const parsedBody = LoginParams.safeParse(req.body);
  if (!parsedBody.success) {
    logger.warn('Invalid Request Body', 'LOGIN', req, {
      cause: z.treeifyError(parsedBody.error),
    });
    res.status(400).json({ ok: false, message: 'Invalid request body' });
    return;
  }

  const { password, email } = parsedBody.data;

  const query = {
    selector: {
      email: {
        $eq: email,
      },
    },
  };

  const response = await usersDB.find(query);
  const document = response.docs[0];
  if (document === undefined) {
    logger.warn('Attempted login of non-existent user', 'LOGIN', req);
    res.status(401).json({ ok: false, message: 'Unauthorized' });
    return;
  }

  const parseResult = User.safeParse(document);
  if (!parseResult.success) {
    logger.error('Fetched document is invalid', 'LOGIN', req, {
      email,
      cause: z.treeifyError(parseResult.error),
    });
    res.status(500).json({ ok: false, message: 'FORBIDDEN' });
    return;
  }

  const user = parseResult.data;
  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    logger.warn('Attempted login with invalid credentials', 'LOGIN', req, {
      email,
    });
    res.status(401).json({ ok: false, message: 'Unauthorized' });
    return;
  }

  logger.info('User login successful:', 'LOGIN', req, {
    resourceType: 'USERS',
    userID: user._id,
    userRole: user.role,
  });

  res.status(200).json({
    ok: true,
    data: {
      accessToken: signAccessToken(user),
      refreshToken: signRefreshToken(user),
    },
  });
};
