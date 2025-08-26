import { type Request } from 'express';
import { logsDB } from '../services/couchDB.js';

type LogEntry = {
  timestamp: string;
  action: string;
  success: boolean;
  userID?: string;
  ip?: string;
  userAgent?: string;
  resourceType?: string;
  resourceId?: string;
};

export const writeAuditLog = async (
  req: Request,
  action: string,
  options: Partial<Omit<LogEntry, 'timestamp' | 'action'>> & {
    success: boolean;
  }
) => {
  const log: LogEntry = {
    timestamp: new Date().toISOString(),
    action,
    userID: (req as any).user?._id,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    ...options,
  };

  await logsDB.insert(log);
};
