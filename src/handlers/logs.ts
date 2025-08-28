import { type Response } from 'express';
import z from 'zod';
import { logsDB } from '../services/couchDB';
import { LogQueryParams, type Request } from '../types';
import { buildLogQuery } from '../utils/build-log-query';
import { isAdmin } from '../utils/is-admin';
import { logger } from '../utils/logger';

export const logsHandler = async (req: Request, res: Response) => {
  if (!isAdmin(req)) {
    logger.warn('Unauthorized attempt made', 'LOGS', req);
    res.status(403).json({ ok: false, message: 'FORBIDDEN' });
    return;
  }

  console.log(req.query);

  const parsedResult = LogQueryParams.safeParse(req.query);
  if (!parsedResult.success) {
    logger.warn('Invalid query params for /logs', 'LOGS', req, {
      cause: z.treeifyError(parsedResult.error),
    });
    res.status(400).json({ ok: false, message: 'Invalid query parameters' });
    return;
  }
  const query = parsedResult.data;
  const isEmpty = Object.values(query).every((v) => v === undefined);

  try {
    const logs = [];
    if (isEmpty) {
      const doclist = await logsDB.list({ include_docs: true });
      for (let doc of doclist.rows) {
        if (!doc.id.startsWith('_design')) {
          logs.push({
            ...doc,
          });
        }
      }
    } else {
      const docList = await logsDB.find(buildLogQuery(query));
      logs.push(...docList.docs);
    }
    res.status(200).json({
      ok: true,
      logs,
    });
  } catch (err) {
    logger.error('Failed to fetch logs', 'LOGS', req, { cause: err });
    res.status(500).json({ ok: false, message: 'Unhandled Exception' });
  }
};
