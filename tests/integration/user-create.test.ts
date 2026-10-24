import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { createApp } from '../../apps/api/src/app.ts';
import { provisionUser } from '../../scripts/lib/user-provision.ts';

process.loadEnvFile('.env');
const origin = process.env.APP_ORIGIN!;
const admin = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL });
const email = `piloto-${crypto.randomUUID()}@chira.test`;
const password = 'piloto-de-campo-2026';
let app: Awaited<ReturnType<typeof createApp>>;
let associationId: string;
let userId: string;

beforeAll(async () => {
  app = await createApp({ logger: false });
  const association = await admin.query<{ id: string }>(
    "SELECT id FROM associations WHERE name='Asociación Chira · Demo'",
  );
  associationId = association.rows[0]!.id;
});
afterAll(async () => {
  if (userId) {
    await admin.query('DELETE FROM memberships WHERE user_id=$1', [userId]);
    await admin.query('DELETE FROM auth_accounts WHERE user_id=$1', [userId]);
    await admin.query('DELETE FROM auth_users WHERE id=$1', [userId]);
  }
  await app?.close();
  await admin.end();
});

describe('pilot account provisioning', () => {
  it('creates an account that signs in with the role and association given', async () => {
    const created = await provisionUser(
      admin,
      {
        email,
        name: 'Técnica del piloto',
        role: 'technician',
        association: associationId,
      },
      password,
    );
    userId = created.userId;
    expect(created.associationId).toBe(associationId);

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      headers: { origin },
      payload: { email, password },
    });
    expect(login.statusCode, login.body).toBe(200);
    const cookie = login.cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    const session = await app.inject({
      url: '/api/v1/session',
      headers: { cookie, origin },
    });
    expect(session.statusCode, session.body).toBe(200);
    const body = session.json();
    expect(body.user.name).toBe('Técnica del piloto');
    expect(body.memberships).toEqual([{ associationId, role: 'technician' }]);
  });

  it('refuses an email that already exists', async () => {
    await expect(
      provisionUser(
        admin,
        {
          email,
          name: 'Duplicada',
          role: 'coordinator',
          association: associationId,
        },
        password,
      ),
    ).rejects.toThrow('Email already registered');
    const rows = await admin.query(
      'SELECT count(*)::int AS total FROM auth_users WHERE email=$1',
      [email],
    );
    expect(rows.rows[0]!.total).toBe(1);
  });

  it('refuses an association that does not exist', async () => {
    await expect(
      provisionUser(
        admin,
        {
          email: `nadie-${crypto.randomUUID()}@chira.test`,
          name: 'Sin asociación',
          role: 'technician',
          association: 'Asociación inexistente',
        },
        password,
      ),
    ).rejects.toThrow('Association not found');
  });
});
