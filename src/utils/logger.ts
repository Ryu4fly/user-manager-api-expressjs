import { logsDB } from '../services/couchDB.js';
import type { AuthRequest } from '../types.js';
import type { ParsedQs } from 'qs';
/**
 * The express package re-exports many core types from express-serve-static-core, but not all of them, and ParamsDictionary is one of the missing ones.
 * It’s commonly used internally as the default for req.params.
 */
import type { ParamsDictionary } from 'express-serve-static-core';

const LOG_LEVELS = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
} as const;
const LogLevelList = [...Object.values(LOG_LEVELS)];
type LogLevel = (typeof LogLevelList)[number];

type LogEntry = {
  timestamp: string;
  level: LogLevel;
  message: string;

  path?: string;
  params?: ParamsDictionary;
  query?: ParsedQs;
  method?: string;
  ip?: string;
  userAgent?: string;
};

class Logger {
  private async log(
    message: string,
    req: AuthRequest,
    level: LogLevel,
    extra: Record<string, any>
  ) {
    const log: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...extra,
    };

    if (req?.method) {
      log.method = req.method;
    }
    if (req?.path) {
      log.path = req.path;
    }
    if (req?.params) {
      log.params = req.params;
    }
    if (req?.query) {
      log.query = req.query;
    }
    if (req?.ip) {
      log.ip = req.ip;
    }
    const userAgent = req?.headers['user-agent'];
    if (userAgent) {
      log.userAgent = userAgent;
    }

    try {
      await logsDB.insert(log);
    } catch (err) {
      console.error('Failed to write audit log', err);
    }
  }

  info(message: string, req: AuthRequest, extra: Record<string, any> = {}) {
    return this.log(message, req, LOG_LEVELS.INFO, extra);
  }

  warn(message: string, req: AuthRequest, extra: Record<string, any> = {}) {
    return this.log(message, req, LOG_LEVELS.WARN, extra);
  }

  error(message: string, req: AuthRequest, extra: Record<string, any> = {}) {
    return this.log(message, req, LOG_LEVELS.ERROR, extra);
  }
}

export const logger = new Logger();
