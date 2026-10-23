import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import sharp from 'sharp';
import { createApp } from '../../apps/api/src/app.ts';
import { withPrincipal } from '../../packages/data/src/database.ts';
import { runFollowUp } from '../../apps/worker/src/follow-up.ts';
import { PostgresInspectionRepository } from '../../packages/data/src/inspection-repository.ts';

process.loadEnvFile('.env');
type Fixture = {
  associationId: string;
  otherAssociationId: string;
  parcelId: string;
  otherParcelId: string;
  techId: string;
  otherTechId: string;
  coordinatorId: string;
  password: string;
};
let fixture: Fixture;
let app: Awaited<ReturnType<typeof createApp>>;
let cookie: string;
let coordinatorCookie: string;
let otherCookie: string;
const origin = process.env.APP_ORIGIN!;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const admin = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL });
const inspectionId = crypto.randomUUID();
const photoId = crypto.randomUUID();
const op = () => crypto.randomUUID();
const headers = (session = cookie) => ({
  cookie: session,
  origin,
  'x-association-id': fixture.associationId,
});

async function login(email: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-in/email',
    headers: { origin },
    payload: { email, password: fixture.password },
  });
  expect(response.statusCode, response.body).toBe(200);
  return response.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}

beforeAll(async () => {
  fixture = JSON.parse(await readFile('.local/demo-credentials.json', 'utf8'));
  app = await createApp({ logger: false });
  cookie = await login('tecnico@chira.test');
  coordinatorCookie = await login('coordinador@chira.test');
  otherCookie = await login('otro@chira.test');
});
afterAll(async () => {
  await app?.close();
  await pool.end();
  await admin.end();
});

describe('tenant isolation at real HTTP and PostgreSQL boundaries', () => {
  it('requires a session and rejects a forged association header', async () => {
    expect((await app.inject('/api/v1/parcels')).statusCode).toBe(401);
    const r = await app.inject({
      url: '/api/v1/parcels',
      headers: { ...headers(), 'x-association-id': fixture.otherAssociationId },
    });
    expect(r.statusCode).toBe(403);
  });
  it('does not return foreign parcels and does not leak context through pooled connections', async () => {
    const p = {
      userId: fixture.techId,
      associationId: fixture.associationId,
      role: 'technician' as const,
    };
    const first = await withPrincipal(pool, p, async (c) =>
      c.query('select id from parcels'),
    );
    expect(first.rows.map((r) => r.id)).toContain(fixture.parcelId);
    expect(first.rows.map((r) => r.id)).not.toContain(fixture.otherParcelId);
    const next = await pool.query('select id from parcels');
    expect(next.rows).toEqual([]);
    await expect(
      withPrincipal(
        pool,
        { ...p, associationId: fixture.otherAssociationId },
        async (c) => c.query('select id from parcels'),
      ),
    ).rejects.toThrow('FORBIDDEN');
    expect((await pool.query('select id from parcels')).rows).toEqual([]);
  });
  it('rejects cross-site mutations and public signup', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/parcels',
      headers: { ...headers(), origin: 'https://evil.example' },
      payload: {},
    });
    expect(r.statusCode).toBe(403);
    const signup = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      headers: { origin },
      payload: {
        email: 'attacker@chira.test',
        password: fixture.password,
        name: 'Attacker',
      },
    });
    expect(signup.statusCode).toBeGreaterThanOrEqual(400);
  });
});

describe('evidence flow and hostile inputs', () => {
  it('does not overwrite an inspection created after an absent-row read', async () => {
    const id = crypto.randomUUID();
    const principal = {
      userId: fixture.techId,
      associationId: fixture.associationId,
    };
    const evidence = {
      id,
      parcelId: fixture.parcelId,
      authorId: fixture.techId,
      notes: 'Winning evidence',
      biosecurity: true,
      photoIds: [],
      status: 'draft' as const,
      version: 1,
      observedAt: new Date().toISOString(),
    };
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let observed!: () => void;
    const missing = new Promise<void>((resolve) => {
      observed = resolve;
    });
    const delayed = withPrincipal(pool, principal, async (client, p) => {
      const repository = new PostgresInspectionRepository(client, p);
      expect(await repository.find(id)).toBeUndefined();
      observed();
      await gate;
      await repository.save({ ...evidence, notes: 'Stale overwrite' });
    });
    await missing;
    // A separate pool is needed because the pool under test intentionally has max=1.
    const concurrent = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      await withPrincipal(concurrent, principal, async (client, p) =>
        new PostgresInspectionRepository(client, p).save(evidence),
      );
      release();
      await expect(delayed).rejects.toThrow('VERSION_CONFLICT');
      expect(
        (
          await admin.query(
            'SELECT notes,version FROM inspections WHERE id=$1',
            [id],
          )
        ).rows[0],
      ).toEqual({ notes: 'Winning evidence', version: 1 });
    } finally {
      release();
      await concurrent.end();
    }
  });
  it('saves idempotently, rejects stale writes and preserves text as data', async () => {
    const payload = {
      operationId: op(),
      expectedVersion: 0,
      authorId: fixture.techId,
      parcelId: fixture.parcelId,
      notes: '<script>alert(1)</script>',
      observedAt: new Date().toISOString(),
      biosecurity: true,
      photoIds: [photoId],
    };
    const request = {
      method: 'PUT' as const,
      url: `/api/v1/inspections/${inspectionId}`,
      headers: headers(),
      payload,
    };
    const mismatchedAuthor = await app.inject({
      ...request,
      headers: headers(coordinatorCookie),
    });
    expect(mismatchedAuthor.statusCode).toBe(403);
    const [a, concurrentReplay] = await Promise.all([
      app.inject(request),
      app.inject(request),
    ]);
    expect(a.statusCode, a.body).toBe(200);
    expect(concurrentReplay.statusCode).toBe(200);
    expect(concurrentReplay.json()).toEqual(a.json());
    expect(a.json()).toMatchObject({ version: 1, notes: payload.notes });
    expect((await app.inject(request)).json()).toEqual(a.json());
    const collision = await app.inject({
      ...request,
      payload: { ...payload, notes: 'changed body, reused key' },
    });
    expect(collision.statusCode).toBe(409);
    const stale = await app.inject({
      ...request,
      payload: { ...payload, operationId: op() },
    });
    expect(stale.statusCode).toBe(409);
    const foreign = await app.inject({
      ...request,
      url: `/api/v1/inspections/${crypto.randomUUID()}`,
      payload: {
        ...payload,
        operationId: op(),
        parcelId: fixture.otherParcelId,
      },
    });
    expect(foreign.statusCode).toBe(404);
  });
  it('refuses submission with unconfirmed photos and rejects fake images', async () => {
    const r = await app.inject({
      method: 'POST',
      url: `/api/v1/inspections/${inspectionId}/submit`,
      headers: headers(),
      payload: { operationId: op(), expectedVersion: 1 },
    });
    expect(r.statusCode).toBe(409);
    const invalid = await app.inject({
      method: 'PUT',
      url: `/api/v1/inspections/${inspectionId}/photos/${photoId}`,
      headers: { ...headers(), 'content-type': 'application/octet-stream' },
      payload: Buffer.from('<svg onload="alert(1)"/>'),
    });
    expect(invalid.statusCode).toBe(415);
  });
  it('reencodes valid photos, serves privately and completes submission', async () => {
    const png = await sharp({
      create: { width: 20, height: 20, channels: 3, background: '#008855' },
    })
      .png()
      .toBuffer();
    const request = {
      method: 'PUT' as const,
      url: `/api/v1/inspections/${inspectionId}/photos/${photoId}`,
      headers: { ...headers(), 'content-type': 'application/octet-stream' },
      payload: png,
    };
    const r = await app.inject(request);
    expect(r.statusCode, r.body).toBe(200);
    expect((await app.inject(request)).statusCode).toBe(200);
    expect(
      (await app.inject({ url: `/api/v1/photos/${photoId}` })).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          url: `/api/v1/photos/${photoId}`,
          headers: {
            ...headers(otherCookie),
            'x-association-id': fixture.otherAssociationId,
          },
        })
      ).statusCode,
    ).toBe(404);
    const photo = await app.inject({
      url: `/api/v1/photos/${photoId}`,
      headers: headers(),
    });
    expect(photo.headers['content-type']).toContain('image/webp');
    expect((await sharp(photo.rawPayload).metadata()).exif).toBeUndefined();
    const submit = await app.inject({
      method: 'POST',
      url: `/api/v1/inspections/${inspectionId}/submit`,
      headers: headers(),
      payload: { operationId: op(), expectedVersion: 1 },
    });
    expect(submit.statusCode, submit.body).toBe(200);
    expect(submit.json()).toMatchObject({ status: 'submitted', version: 2 });
  });
  it('enforces coordinator-only reviews and rejects cross-tenant worker jobs', async () => {
    const request = {
      method: 'POST' as const,
      url: `/api/v1/inspections/${inspectionId}/reviews`,
      payload: {
        operationId: op(),
        expectedVersion: 2,
        notes: 'Programar visita agronómica; no es un diagnóstico',
        followUp: true,
      },
    };
    expect(
      (await app.inject({ ...request, headers: headers() })).statusCode,
    ).toBe(403);
    const r = await app.inject({
      ...request,
      headers: headers(coordinatorCookie),
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({ status: 'reviewed', version: 3 });
    const worker = new Pool({
      connectionString: process.env.WORKER_DATABASE_URL,
    });
    try {
      await expect(
        runFollowUp(worker, {
          associationId: fixture.otherAssociationId,
          userId: fixture.coordinatorId,
          inspectionId,
          eventId: crypto.randomUUID(),
        }),
      ).rejects.toThrow('FORBIDDEN');
      const eventId = (
        await admin.query(
          'SELECT id FROM notification_outbox WHERE inspection_id=$1',
          [inspectionId],
        )
      ).rows[0].id;
      await expect(
        runFollowUp(worker, {
          associationId: fixture.associationId,
          userId: fixture.coordinatorId,
          inspectionId,
          eventId: crypto.randomUUID(),
        }),
      ).rejects.toThrow('INVALID_JOB_EVENT');
      await expect(
        runFollowUp(worker, {
          associationId: fixture.associationId,
          userId: fixture.techId,
          inspectionId,
          eventId,
        }),
      ).rejects.toThrow();
      await expect(
        runFollowUp(worker, {
          associationId: fixture.associationId,
          userId: fixture.coordinatorId,
          inspectionId: crypto.randomUUID(),
          eventId,
        }),
      ).rejects.toThrow('INVALID_JOB_EVENT');
      await runFollowUp(worker, {
        associationId: fixture.associationId,
        userId: fixture.coordinatorId,
        inspectionId,
        eventId,
      });
      await runFollowUp(worker, {
        associationId: fixture.associationId,
        userId: fixture.coordinatorId,
        inspectionId,
        eventId,
      });
      expect(
        (
          await admin.query(
            'select count(*)::int as count from audit_events where event_key=$1',
            [eventId],
          )
        ).rows[0].count,
      ).toBe(1);
    } finally {
      await worker.end();
    }
  });
  it('exports only authorized records and expires a revoked session', async () => {
    expect(
      (
        await app.inject({
          url: '/api/v1/exports/parcels.geojson',
          headers: headers(),
        })
      ).statusCode,
    ).toBe(403);
    const r = await app.inject({
      url: '/api/v1/exports/parcels.geojson',
      headers: headers(coordinatorCookie),
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().features.map((f: { id: string }) => f.id)).toContain(
      fixture.parcelId,
    );
    expect(r.json().features.map((f: { id: string }) => f.id)).not.toContain(
      fixture.otherParcelId,
    );
    await admin.query('delete from auth_sessions where user_id=$1', [
      fixture.techId,
    ]);
    expect(
      (await app.inject({ url: '/api/v1/parcels', headers: headers() }))
        .statusCode,
    ).toBe(401);
  });
});
