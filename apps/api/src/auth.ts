import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import * as schema from '../../../packages/data/src/auth-schema.ts';

export function makeAuth(pool: Pool, origin: string) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32 || secret.startsWith('CHANGE_ME'))
    throw new Error(
      'A unique BETTER_AUTH_SECRET with 32+ characters is required',
    );
  if (process.env.NODE_ENV === 'production' && !origin.startsWith('https://'))
    throw new Error('HTTPS required in production');
  return betterAuth({
    secret,
    baseURL: origin,
    trustedOrigins: [origin],
    database: drizzleAdapter(drizzle(pool, { schema }), {
      provider: 'pg',
      schema,
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    session: {
      expiresIn: 60 * 60 * 8,
      updateAge: 60 * 60,
      cookieCache: { enabled: false },
    },
    advanced: {
      database: { generateId: () => crypto.randomUUID() },
      useSecureCookies: origin.startsWith('https://'),
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: 'lax',
        secure: origin.startsWith('https://'),
      },
    },
    rateLimit: { enabled: true, window: 60, max: 20 },
    telemetry: { enabled: false },
    logger: { disabled: true },
  });
}
