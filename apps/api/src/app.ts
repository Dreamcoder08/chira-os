import Fastify, {
  LogController,
  type FastifyRequest,
  type FastifyError,
} from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import fastifyStatic from '@fastify/static';
import { Type } from '@sinclair/typebox';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import sharp from 'sharp';
import type { PoolClient } from 'pg';
import {
  makePool,
  withPrincipal,
} from '../../../packages/data/src/database.ts';
import { makeStorage } from '../../../packages/data/src/storage.ts';
import { idempotent } from '../../../packages/data/src/idempotency.ts';
import { PostgresInspectionRepository } from '../../../packages/data/src/inspection-repository.ts';
import { InspectionService } from '../../../packages/domain/src/inspection-service.ts';
import {
  DomainError,
  safeCsvCell,
} from '../../../packages/domain/src/guardian.ts';
import type { Principal, Parcel } from '../../../packages/domain/src/ports.ts';
import * as S from '../../../packages/contracts/src/schemas.ts';
import { makeAuth } from './auth.ts';
import { isTrustedOrigin } from './origin.ts';

const parcelProjection = `id,name,producer_name AS "producerName",crop,hectares::float,ST_AsGeoJSON(location)::json AS location,assigned_to AS "assignedTo"`;
function webHeaders(request: FastifyRequest) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers))
    if (value !== undefined)
      headers.set(name, Array.isArray(value) ? value.join(', ') : value);
  return headers;
}
function coordinator(principal: Principal) {
  if (principal.role !== 'coordinator') throw new DomainError('FORBIDDEN', 403);
}
function uuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value)
  );
}

export async function createApp(options: { logger?: boolean } = {}) {
  const origin = process.env.APP_ORIGIN ?? 'http://localhost:5173';
  const pool = makePool(process.env.DATABASE_URL);
  const authPool = makePool(process.env.AUTH_DATABASE_URL);
  const auth = makeAuth(authPool, origin);
  const storage = makeStorage();
  const app = Fastify({
    logger:
      options.logger === false
        ? false
        : {
            level: 'info',
            redact: [
              'req.headers.cookie',
              'req.headers.authorization',
              'res.headers.set-cookie',
              'password',
              'token',
            ],
          },
    logController: new LogController({ disableRequestLogging: true }),
    bodyLimit: 64 * 1024,
    trustProxy: false,
    ajv: {
      customOptions: {
        removeAdditional: false,
        coerceTypes: false,
        allErrors: false,
      },
    },
  });
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'blob:', 'data:'],
        connectSrc: ["'self'"],
        workerSrc: ["'self'", 'blob:'],
        objectSrc: ["'none'"],
        baseUri: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        upgradeInsecureRequests:
          process.env.NODE_ENV === 'production' ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: process.env.NODE_ENV === 'production' ? { maxAge: 31536000 } : false,
  });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
    // Public shell assets must not exhaust the quota for protected data requests.
    keyGenerator: (request) =>
      `${request.ip}:${request.method}:${request.routeOptions.url ?? 'unmatched'}`,
  });
  await app.register(swagger, {
    openapi: {
      info: { title: 'CHIRA OS Guardian', version: '0.1.0' },
      components: {
        securitySchemes: {
          session: {
            type: 'apiKey',
            in: 'cookie',
            name: 'better-auth.session_token',
          },
          association: {
            type: 'apiKey',
            in: 'header',
            name: 'x-association-id',
          },
        },
      },
      security: [{ session: [], association: [] }],
    },
  });
  app.addContentTypeParser(
    'application/octet-stream',
    { parseAs: 'buffer', bodyLimit: 8 * 1024 * 1024 },
    (_request, body, done) => done(null, body),
  );
  app.addHook('onRequest', async (request, reply) => {
    if (request.url.startsWith('/api/')) {
      reply.header('Cache-Control', 'no-store');
      if (
        !['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
        !isTrustedOrigin(request.headers.origin, origin)
      )
        throw new DomainError('ORIGIN_REJECTED', 403);
    }
  });
  app.addHook('onResponse', async (request, reply) => {
    app.log.info(
      {
        requestId: request.id,
        route: request.routeOptions.url,
        method: request.method,
        status: reply.statusCode,
        durationMs: reply.elapsedTime,
      },
      'http.response',
    );
  });
  app.setErrorHandler<FastifyError>((error, request, reply) => {
    if (error instanceof DomainError)
      return reply
        .code(error.status)
        .send({ error: error.code, requestId: request.id });
    if (error.validation)
      return reply
        .code(400)
        .send({ error: 'INVALID_REQUEST', requestId: request.id });
    const dbCode = 'code' in error ? String(error.code) : '';
    if (dbCode === '23505')
      return reply
        .code(409)
        .send({ error: 'RESOURCE_CONFLICT', requestId: request.id });
    if (['23503', '23514', '22P02', '42501'].includes(dbCode))
      return reply
        .code(400)
        .send({ error: 'INVALID_RESOURCE', requestId: request.id });
    if (error.statusCode && error.statusCode < 500)
      return reply
        .code(error.statusCode)
        .send({ error: 'REQUEST_REJECTED', requestId: request.id });
    app.log.error(
      { requestId: request.id, code: dbCode || 'INTERNAL_ERROR' },
      'http.error',
    );
    return reply
      .code(500)
      .send({ error: 'INTERNAL_ERROR', requestId: request.id });
  });
  async function currentUser(request: FastifyRequest) {
    const session = await auth.api.getSession({ headers: webHeaders(request) });
    if (!session) throw new DomainError('UNAUTHENTICATED', 401);
    return session.user;
  }
  async function scoped<T>(
    request: FastifyRequest,
    action: (client: PoolClient, principal: Principal) => Promise<T>,
  ) {
    const user = await currentUser(request);
    const associationId =
      request.headers['x-association-id'] ??
      (request.method === 'GET'
        ? (request.query as { associationId?: unknown }).associationId
        : undefined);
    if (!uuid(associationId))
      throw new DomainError('ASSOCIATION_REQUIRED', 400);
    return withPrincipal(pool, { userId: user.id, associationId }, action);
  }
  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    handler: async (request, reply) => {
      const path = request.url.split('?')[0];
      const allowed =
        (request.method === 'POST' &&
          ['/api/auth/sign-in/email', '/api/auth/sign-out'].includes(path!)) ||
        (request.method === 'GET' && path === '/api/auth/get-session');
      if (!allowed) throw new DomainError('NOT_FOUND', 404);
      const response = await auth.handler(
        new Request(`${origin}${request.url}`, {
          method: request.method,
          headers: webHeaders(request),
          ...(request.method !== 'GET'
            ? { body: JSON.stringify(request.body ?? {}) }
            : {}),
        }),
      );
      reply.code(response.status);
      for (const [name, value] of response.headers)
        if (name !== 'set-cookie') reply.header(name, value);
      const cookies = response.headers.getSetCookie();
      if (cookies.length) reply.header('set-cookie', cookies);
      return reply.send(await response.text());
    },
  });
  app.get(
    '/health/live',
    {
      schema: {
        response: { 200: Type.Object({ status: Type.Literal('ok') }) },
      },
    },
    async () => ({ status: 'ok' }),
  );
  app.get('/health/ready', async () => {
    await pool.query('SELECT 1');
    return { status: 'ok' };
  });
  app.get('/api/v1/session', async (request) => {
    const user = await currentUser(request);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('chira.user_id',$1,true)", [
        user.id,
      ]);
      const memberships = (
        await client.query(
          'SELECT association_id AS "associationId",role FROM memberships WHERE user_id=$1',
          [user.id],
        )
      ).rows;
      await client.query('COMMIT');
      return { user: { id: user.id, name: user.name }, memberships };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });
  app.get(
    '/api/v1/parcels',
    { schema: { response: { 200: Type.Array(S.ParcelSchema) } } },
    async (request) =>
      scoped(
        request,
        async (client) =>
          (
            await client.query<Parcel>(
              `SELECT ${parcelProjection} FROM parcels ORDER BY name LIMIT 500`,
            )
          ).rows,
      ),
  );
  app.post<{ Body: S.CreateParcelInput }>(
    '/api/v1/parcels',
    {
      schema: { body: S.CreateParcelSchema, response: { 201: S.ParcelSchema } },
    },
    async (request, reply) => {
      const result = await scoped(request, async (client, principal) => {
        const b = request.body;
        const id = crypto.randomUUID();
        await client.query(
          'INSERT INTO parcels(id,association_id,name,producer_name,crop,hectares,location,assigned_to) VALUES($1,$2,$3,$4,$5,$6,ST_SetSRID(ST_MakePoint($7,$8),4326),$9)',
          [
            id,
            principal.associationId,
            b.name.trim(),
            b.producerName.trim(),
            b.crop.trim(),
            b.hectares,
            ...b.location.coordinates,
            principal.userId,
          ],
        );
        await new PostgresInspectionRepository(client, principal).audit(
          'parcel.created',
          id,
        );
        return { ...b, id, assignedTo: principal.userId };
      });
      return reply.code(201).send(result);
    },
  );
  app.get(
    '/api/v1/inspections',
    { schema: { response: { 200: Type.Array(S.InspectionSchema) } } },
    async (request) =>
      scoped(
        request,
        async (client) =>
          (
            await client.query(
              `SELECT id,parcel_id AS "parcelId",author_id AS "authorId",notes,biosecurity,photo_ids AS "photoIds",status,version,to_char(observed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "observedAt" FROM inspections ORDER BY updated_at DESC LIMIT 500`,
            )
          ).rows,
      ),
  );
  app.put<{ Params: { id: string }; Body: S.EditInspectionInput }>(
    '/api/v1/inspections/:id',
    {
      schema: {
        params: S.IdParams,
        body: S.EditInspectionSchema,
        response: { 200: S.InspectionSchema },
      },
    },
    async (request) =>
      scoped(request, async (client, principal) => {
        const b = request.body;
        if (b.authorId !== principal.userId)
          throw new DomainError('AUTHOR_SESSION_MISMATCH', 403);
        if (
          !(
            await client.query('SELECT 1 FROM parcels WHERE id=$1', [
              b.parcelId,
            ])
          ).rowCount
        )
          throw new DomainError('NOT_FOUND', 404);
        return idempotent(
          client,
          principal,
          b.operationId,
          [request.params.id, 'edit', b],
          () =>
            new InspectionService(
              new PostgresInspectionRepository(client, principal),
              principal,
            ).edit(
              {
                ...b,
                id: request.params.id,
                authorId: principal.userId,
                status: 'draft',
                version: b.expectedVersion,
              },
              b.expectedVersion,
            ),
        );
      }),
  );
  app.post<{ Params: { id: string }; Body: S.OperationInput }>(
    '/api/v1/inspections/:id/submit',
    {
      schema: {
        params: S.IdParams,
        body: S.OperationSchema,
        response: { 200: S.InspectionSchema },
      },
    },
    async (request) =>
      scoped(request, async (client, principal) =>
        idempotent(
          client,
          principal,
          request.body.operationId,
          [request.params.id, 'submit', request.body],
          () =>
            new InspectionService(
              new PostgresInspectionRepository(client, principal),
              principal,
            ).submit(request.params.id, request.body.expectedVersion),
        ),
      ),
  );
  app.post<{ Params: { id: string }; Body: S.ReviewInput }>(
    '/api/v1/inspections/:id/reviews',
    {
      schema: {
        params: S.IdParams,
        body: S.ReviewSchema,
        response: { 200: S.InspectionSchema },
      },
    },
    async (request) =>
      scoped(request, async (client, principal) => {
        coordinator(principal);
        return idempotent(
          client,
          principal,
          request.body.operationId,
          [request.params.id, 'review', request.body],
          () =>
            new InspectionService(
              new PostgresInspectionRepository(client, principal),
              principal,
            ).review(
              request.params.id,
              request.body.expectedVersion,
              request.body.notes,
              request.body.followUp,
            ),
        );
      }),
  );
  app.put<{ Params: { id: string; photoId: string }; Body: Buffer }>(
    '/api/v1/inspections/:id/photos/:photoId',
    { bodyLimit: 8 * 1024 * 1024, schema: { params: S.PhotoParams } },
    async (request) =>
      scoped(request, async (client, principal) => {
        if (!Buffer.isBuffer(request.body))
          throw new DomainError('IMAGE_REQUIRED', 415);
        const repository = new PostgresInspectionRepository(client, principal);
        const inspection = await repository.find(request.params.id);
        if (!inspection) throw new DomainError('NOT_FOUND', 404);
        if (inspection.authorId !== principal.userId)
          throw new DomainError('FORBIDDEN', 403);
        const digest = createHash('sha256').update(request.body).digest('hex');
        const existing = (
          await client.query<{ digest: string; inspection_id: string }>(
            'SELECT digest,inspection_id FROM photos WHERE id=$1',
            [request.params.photoId],
          )
        ).rows[0];
        if (existing) {
          if (
            existing.digest !== digest ||
            existing.inspection_id !== inspection.id
          )
            throw new DomainError('PHOTO_KEY_REUSED', 409);
          return { id: request.params.photoId };
        }
        if (
          inspection.status !== 'draft' ||
          !inspection.photoIds.includes(request.params.photoId)
        )
          throw new DomainError('PHOTO_NOT_EXPECTED', 409);
        let encoded: Buffer;
        try {
          const image = sharp(request.body, {
            limitInputPixels: 20_000_000,
            animated: false,
          });
          const metadata = await image.metadata();
          if (
            !['jpeg', 'png', 'webp'].includes(metadata.format ?? '') ||
            (metadata.pages ?? 1) > 1
          )
            throw new Error('Unsupported image');
          encoded = await image
            .rotate()
            .resize({
              width: 2048,
              height: 2048,
              fit: 'inside',
              withoutEnlargement: true,
            })
            .webp({ quality: 82 })
            .toBuffer();
        } catch {
          throw new DomainError('INVALID_IMAGE', 415);
        }
        const key = `${principal.associationId}/${inspection.id}/${request.params.photoId}.webp`;
        await storage.put(key, encoded);
        await client.query(
          'INSERT INTO photos(id,association_id,inspection_id,storage_key,digest) VALUES($1,$2,$3,$4,$5)',
          [
            request.params.photoId,
            principal.associationId,
            inspection.id,
            key,
            digest,
          ],
        );
        await repository.audit('photo.confirmed', inspection.id);
        return { id: request.params.photoId };
      }),
  );
  app.get<{ Params: { id: string } }>(
    '/api/v1/photos/:id',
    { schema: { params: S.IdParams } },
    async (request, reply) => {
      const bytes = await scoped(request, async (client) => {
        const photo = (
          await client.query<{ storage_key: string }>(
            'SELECT storage_key FROM photos WHERE id=$1',
            [request.params.id],
          )
        ).rows[0];
        if (!photo) throw new DomainError('NOT_FOUND', 404);
        return storage.get(photo.storage_key);
      });
      return reply
        .header('Content-Disposition', 'inline; filename="evidence.webp"')
        .type('image/webp')
        .send(Buffer.from(bytes));
    },
  );
  app.get('/api/v1/reviews', async (request) =>
    scoped(
      request,
      async (client) =>
        (
          await client.query(
            'SELECT inspection_id AS "inspectionId",notes,follow_up AS "followUp",created_at AS "createdAt" FROM reviews ORDER BY created_at DESC LIMIT 500',
          )
        ).rows,
    ),
  );
  app.get('/api/v1/exports/parcels.geojson', async (request) =>
    scoped(request, async (client, principal) => {
      coordinator(principal);
      const rows = (
        await client.query<Parcel>(
          `SELECT ${parcelProjection} FROM parcels ORDER BY id`,
        )
      ).rows;
      await new PostgresInspectionRepository(client, principal).audit(
        'export.parcels',
        principal.associationId,
      );
      return {
        type: 'FeatureCollection',
        features: rows.map((p) => ({
          type: 'Feature',
          id: p.id,
          geometry: p.location,
          properties: {
            name: p.name,
            producerName: p.producerName,
            crop: p.crop,
            hectares: p.hectares,
          },
        })),
      };
    }),
  );
  app.get('/api/v1/exports/inspections.csv', async (request, reply) => {
    const csv = await scoped(request, async (client, principal) => {
      coordinator(principal);
      const rows = (
        await client.query(
          'SELECT id,parcel_id,notes,status,observed_at FROM inspections ORDER BY observed_at',
        )
      ).rows;
      await new PostgresInspectionRepository(client, principal).audit(
        'export.inspections',
        principal.associationId,
      );
      return [
        'id,parcel_id,notes,status,observed_at',
        ...rows.map((r) =>
          [
            r.id,
            r.parcel_id,
            r.notes,
            r.status,
            new Date(r.observed_at).toISOString(),
          ]
            .map(safeCsvCell)
            .join(','),
        ),
      ].join('\r\n');
    });
    return reply
      .type('text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="inspections.csv"')
      .send(csv);
  });
  if (existsSync(resolve('apps/web/dist/index.html'))) {
    await app.register(fastifyStatic, {
      root: resolve('apps/web/dist'),
      wildcard: false,
    });
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/') || request.method !== 'GET')
        return reply.code(404).send({ error: 'NOT_FOUND' });
      return reply.sendFile('index.html');
    });
  }
  app.addHook('onClose', async () => {
    await pool.end();
    await authPool.end();
  });
  await app.ready();
  return app;
}
