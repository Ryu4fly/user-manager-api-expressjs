import { type Request as ExpressRequest } from 'express';
import z from 'zod';
import { LogLevelList } from './utils/logger';

export const User = z.object({
  _id: z.string(),
  _rev: z.string(),
  email: z.string(),
  password: z.string(),
  role: z.union([z.literal('admin'), z.literal('user')]).default('user'),
});
export type User = z.infer<typeof User>;

export const RegisterParams = z
  .object({
    email: z.string().nonempty(),
    password: z.string().nonempty(),
    password_confirm: z.string().nonempty(),
  })
  .superRefine(({ password, password_confirm }, ctx) => {
    if (password !== password_confirm) {
      ctx.addIssue({ code: 'custom', message: 'password must be matching' });
    }
  });
export type RegisterParams = z.infer<typeof RegisterParams>;

export const LoginParams = z.object({
  email: z.email(),
  password: z.string().nonempty(),
});
export type LoginParams = z.infer<typeof LoginParams>;

export type UserPayloadJWT = {
  id: string;
  email: string;
  role: 'admin' | 'user';
};

export interface Request extends ExpressRequest {
  user?: UserPayloadJWT;
}

export const LogQueryParams = z
  .object({
    level: z.union(LogLevelList.map((level) => z.literal(level))),
    resourceType: z.string(),
    from: z.preprocess((val) => {
      return Number(val);
    }, z.int().positive()),
    to: z.preprocess((val) => {
      return Number(val);
    }, z.int().positive()),
  })
  .partial();
export type LogQueryParams = z.infer<typeof LogQueryParams>;
