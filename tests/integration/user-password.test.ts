import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { createApp } from '../../apps/api/src/app.ts';
import {
  provisionUser,
  resetUserPassword,
} from '../../scripts/lib/user-provision.ts';

process.loadEnvFile('.env');
const origin = process.env.APP_ORIGIN!;
const admin = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL });
const email = `reinicio-${crypto.randomUUID()}@chira.test`;
const originalPassword = 'piloto-de-campo-2026';
const newPassword = 'clave-nueva-de-campo-2026';
let app: Awaited<ReturnType<typeof createApp>>;
let userId: string;

async function signIn(password: string) {
  return app.inject({
    method: 'POST',
    url: '/api/auth/sign-in/email',
    headers: { origin },
    payload: { email, password },
  });
}

beforeAll(async () => {
  app = await createApp({ logger: false });
  const association = await admin.query<{ id: string }>(
    "SELECT id FROM associations WHERE name='Asociación Chira · Demo'",
  );
  const created = await provisionUser(
    admin,
    {
      email,
      name: 'Técnica que olvidó la clave',
      role: 'technician',
      association: association.rows[0]!.id,
    },
    originalPassword,
  );
  userId = created.userId;
});
afterAll(async () => {
  if (userId) {
    await admin.query('DELETE FROM auth_sessions WHERE user_id=$1', [userId]);
    await admin.query('DELETE FROM memberships WHERE user_id=$1', [userId]);
    await admin.query('DELETE FROM auth_accounts WHERE user_id=$1', [userId]);
    await admin.query('DELETE FROM auth_users WHERE id=$1', [userId]);
  }
  await app?.close();
  await admin.end();
});

describe('pilot password reset', () => {
  it('replaces the password, closes open sessions and keeps the membership', async () => {
    const login = await signIn(originalPassword);
    expect(login.statusCode, login.body).toBe(200);
    const cookie = login.cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    const reset = await resetUserPassword(admin, email, newPassword);
    expect(reset).toMatchObject({
      userId,
      role: 'technician',
      associationName: 'Asociación Chira · Demo',
    });
    expect(reset.revokedSessions).toBeGreaterThanOrEqual(1);

    const revoked = await app.inject({
      url: '/api/v1/session',
      headers: { cookie, origin },
    });
    expect(revoked.statusCode, revoked.body).toBe(401);

    const previous = await signIn(originalPassword);
    expect(previous.statusCode).toBe(401);

    const current = await signIn(newPassword);
    expect(current.statusCode, current.body).toBe(200);
    const session = await app.inject({
      url: '/api/v1/session',
      headers: {
        cookie: current.cookies.map((c) => `${c.name}=${c.value}`).join('; '),
        origin,
      },
    });
    expect(session.statusCode, session.body).toBe(200);
    expect(session.json().memberships).toEqual([
      { associationId: expect.any(String), role: 'technician' },
    ]);
  });

  it('refuses an email that has no account', async () => {
    await expect(
      resetUserPassword(
        admin,
        `nadie-${crypto.randomUUID()}@chira.test`,
        newPassword,
      ),
    ).rejects.toThrow('User not found');
  });

  it('refuses an account without a password credential', async () => {
    const id = crypto.randomUUID();
    const orphan = `sin-clave-${id}@chira.test`;
    await admin.query(
      'INSERT INTO auth_users(id,name,email,email_verified) VALUES($1,$2,$3,true)',
      [id, 'Sin credencial', orphan],
    );
    try {
      await expect(
        resetUserPassword(admin, orphan, newPassword),
      ).rejects.toThrow('No password credential');
    } finally {
      await admin.query('DELETE FROM auth_users WHERE id=$1', [id]);
    }
  });
});
