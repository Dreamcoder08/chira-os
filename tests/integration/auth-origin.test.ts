import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { createApp } from '../../apps/api/src/app.ts';

process.loadEnvFile('.env');
const origin = process.env.APP_ORIGIN!;
const pool = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL });
let app: Awaited<ReturnType<typeof createApp>>;

async function signIn(from: string) {
  return app.inject({
    method: 'POST',
    url: '/api/auth/sign-in/email',
    headers: { origin: from },
    payload: { email: 'equipo@chira.test', password: 'intento-de-clave-2026' },
  });
}

function loopbackAlias(host: string) {
  const url = new URL(origin);
  return `${url.protocol}//${host}:${url.port}`;
}

beforeAll(async () => {
  app = await createApp({ logger: false });
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('sign-in origin', () => {
  // A technician who types 127.0.0.1 instead of localhost is on the same
  // machine hitting the same server, and better-auth answered 403 without
  // saying why. The password was never the problem.
  it('accepts every loopback spelling of the configured origin', async () => {
    for (const host of ['localhost', '127.0.0.1', '[::1]'])
      expect((await signIn(loopbackAlias(host))).statusCode, host).toBe(401);
  });

  it('still refuses a foreign origin', async () => {
    expect((await signIn('https://evil.example')).statusCode).toBe(403);
  });
});
