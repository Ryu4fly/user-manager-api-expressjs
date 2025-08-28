import type { LogQueryParams } from '../types';
import type { MangoQuery } from 'nano';

export const buildLogQuery = (filters: LogQueryParams): MangoQuery => {
  const selector: Record<string, any> = {};

  if (filters?.level) selector.level = filters.level;
  if (filters?.resourceType) selector.resourceType = filters.resourceType;

  if (filters?.from || filters?.to) {
    selector.timestamp = {};
    if (filters?.from) selector.timestamp.$gte = filters.from;
    if (filters?.to) selector.timestamp.$lte = filters.to;
  }

  return {
    selector,
  };
};
