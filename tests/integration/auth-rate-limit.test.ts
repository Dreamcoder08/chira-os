import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { createApp } from '../../apps/api/src/app.ts';

process.loadEnvFile('.env');
const origin = process.env.APP_ORIGIN!;
const pool = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL });
let app: Awaited<ReturnType<typeof createApp>>;

async function signIn(email: string) {
  return app.inject({
    method: 'POST',
    url: '/api/auth/sign-in/email',
    headers: { origin },
    payload: { email, password: 'intento-de-clave-2026' },
  });
}

beforeAll(async () => {
  app = await createApp({ logger: false });
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('sign-in rate limit', () => {
  // A pilot team starts the morning together behind one shared address. The
  // better-auth default (three per ten seconds) rejected the fourth technician,
  // which is why the rule is pinned here rather than left to chance.
  it('lets a whole team sign in from one address', async () => {
    for (let attempt = 1; attempt <= 10; attempt += 1)
      expect(
        (await signIn('equipo@chira.test')).statusCode,
        `attempt ${attempt}`,
      ).toBe(401);
  });

  it('still blocks a burst of password guesses', async () => {
    let blocked = 0;
    for (let attempt = 0; attempt < 40 && blocked === 0; attempt += 1)
      if ((await signIn('equipo@chira.test')).statusCode === 429) blocked += 1;
    expect(blocked).toBe(1);
  });
});
