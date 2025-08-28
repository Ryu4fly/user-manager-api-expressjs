import { type Response } from 'express';
import { usersDB } from '../services/couchDB';
import { type Request } from '../types';
import { isAdmin } from '../utils/is-admin';
import { logger } from '../utils/logger';

export const getUsersHandler = async (req: Request, res: Response) => {
  if (!isAdmin(req)) {
    logger.warn('Unauthorized attempt made', 'USERS', req);
    res.status(403).json({ ok: false, message: 'FORBIDDEN' });
    return;
  }

  try {
    // TODO: also includes index docs -- make sure to filter out
    const doclist = await usersDB.list({ include_docs: true });

    const users = doclist.rows.map((row) => ({
      id: row.id,
      email: row.doc?.email,
      role: row.doc?.role,
    }));

    logger.info('Users successfully fetched', 'USERS', req);
    res.status(200).json({ ok: true, users });
  } catch (err) {
    logger.error('Unable to fetch users from database', 'USERS', req, {
      cause: err,
    });
    res.status(500).json({ ok: false, message: 'Unhandled Exception' });
  }
};

// TODO: user should not be able to access other users, unless admin
export const getUserHandler = async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!id) {
    logger.warn('Request made with missing param', 'USERS', req);
    res.status(400).json({ ok: false, message: 'Bad Request' });
    return;
  }

  try {
    const user = await usersDB.get(id);
    logger.info('User successfully fetched', 'USERS', req);
    res.status(200).json({ ok: true, user });
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'statusCode' in err) {
      if (err.statusCode === 404) {
        logger.error('User does not exist', 'USERS', req, {
          cause: err,
        });
        res.status(403).json({ ok: false, message: 'FORBIDDEN' });
        return;
      }
    }

    logger.error('Failed to fetch user by ID', 'USERS', req, {
      cause: err,
    });
    res.status(500).json({ ok: false, message: 'Unhandled Exception' });
  }
};

// TODO: user should not be able to delete other accounts, unless admin
export const deleteUserHandler = async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!id) {
    logger.warn('Missing ID param', 'USERS', req);
    res.status(400).json({ ok: false, message: 'Bad Request' });
    return;
  }

  try {
    const user = await usersDB.get(id);
    await usersDB.destroy(user._id, user._rev);
    logger.info('User successfully deleted', 'USERS', req, {
      userID: id,
      resourceType: 'userS',
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'statusCode' in err) {
      if (err.statusCode === 404) {
        logger.warn('Attempted delete on non-existent user', 'USERS', req, {
          cause: err,
        });
        res.status(403).json({ ok: false, message: 'FORBIDDEN' });
        return;
      }
    }

    logger.error('Failed to delete user', 'USERS', req, {
      userID: id,
      cause: err,
    });
    res.status(500).json({ ok: false, message: 'Unhandled Exception' });
  }
};
