import { logsDB } from '../services/couchDB.js';
import type { Request } from '../types.js';
import type { ParsedQs } from 'qs';
/**
 * The express package re-exports many core types from express-serve-static-core, but not all of them, and ParamsDictionary is one of the missing ones.
 * It’s commonly used internally as the default for req.params.
 */
import type { ParamsDictionary } from 'express-serve-static-core';

export const LOG_LEVELS = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
} as const;
export const LogLevelList = [...Object.values(LOG_LEVELS)];
export type LogLevel = (typeof LogLevelList)[number];

type LogEntry = {
  level: LogLevel;
  resourceType: string;
  message: string;
  timestamp: number;
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
    resourceType: string,
    req: Request,
    level: LogLevel,
    extra: Record<string, any>
  ) {
    const log: LogEntry = {
      level,
      resourceType,
      message,
      timestamp: Date.now(),
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

  info(
    message: string,
    resourceType: string,
    req: Request,
    extra: Record<string, any> = {}
  ) {
    return this.log(message, resourceType, req, LOG_LEVELS.INFO, extra);
  }

  warn(
    message: string,
    resourceType: string,
    req: Request,
    extra: Record<string, any> = {}
  ) {
    return this.log(message, resourceType, req, LOG_LEVELS.WARN, extra);
  }

  error(
    message: string,
    resourceType: string,
    req: Request,
    extra: Record<string, any> = {}
  ) {
    return this.log(message, resourceType, req, LOG_LEVELS.ERROR, extra);
  }
}

export const logger = new Logger();
