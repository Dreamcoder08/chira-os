import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

test('offline field evidence survives reopening, synchronizes and receives human review', async ({
  page,
  context,
}) => {
  const { password } = JSON.parse(
    await readFile('.local/demo-credentials.json', 'utf8'),
  );
  await page.goto('/');
  await page.getByLabel('Correo').fill('tecnico@chira.test');
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(
    page.getByText('Técnico de demostración', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Preparar trabajo offline' }).click();
  await expect(
    page.getByText('Parcelas disponibles sin conexión'),
  ).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Nueva inspección' }).first(),
  ).toBeVisible();
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Nueva inspección' }).first().click();
  const notes = `Visita de campo ${Date.now()} <img src=x onerror=alert(1)>`;
  await page.getByLabel('Observaciones').fill(notes);
  await page.getByLabel('Completé el protocolo de bioseguridad').check();
  const png = await sharp({
    create: { width: 30, height: 30, channels: 3, background: '#24734b' },
  })
    .png()
    .toBuffer();
  await page
    .getByLabel('Fotografías')
    .setInputFiles({ name: 'campo.png', mimeType: 'image/png', buffer: png });
  await page
    .getByRole('button', { name: 'Guardar en este dispositivo' })
    .click();
  await expect(
    page.getByText('Pendiente de sincronizar', { exact: true }),
  ).toBeVisible();
  // The technician must be able to confirm the photo is stored on the device
  // before syncing; a card that hides it looks like lost evidence.
  // A lazy image that is below the fold is never decoded, so naturalWidth
  // stays 0 until it is scrolled into view. The technician scrolls to the card.
  await page
    .getByAltText('Evidencia de inspección')
    .first()
    .scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      page
        .getByAltText('Evidencia de inspección')
        .first()
        .evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.reload();
  await expect(page.getByText(notes, { exact: true })).toBeVisible();
  await expect(page.getByText('Sin conexión', { exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page
        .getByAltText('Evidencia de inspección')
        .first()
        .evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Sincronizar ahora' }).click();
  await expect(
    page.getByText('Enviada', { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Salir' }).click();
  await expect(
    page.getByRole('button', { name: 'Entrar', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      async () =>
        (await indexedDB.databases()).filter((d) => d.name === 'chira-guardian')
          .length,
    ),
  ).toBe(0);
  await page.getByLabel('Correo').fill('coordinador@chira.test');
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  const card = page.locator('article').filter({ hasText: notes });
  await expect(card).toBeVisible();
  await expect(
    card.getByRole('img', { name: 'Evidencia de inspección' }),
  ).toBeVisible();
  await card
    .getByLabel('Revisión del coordinador')
    .fill('Programar visita; observación pendiente de evaluación agronómica.');
  await card.getByLabel('Requiere seguimiento').check();
  await card.getByRole('button', { name: 'Registrar revisión' }).click();
  await expect(card.getByText('Revisada', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Exportar parcelas' }),
  ).toBeVisible();
});

test('unauthenticated responses are private and reject a foreign origin', async ({
  request,
}) => {
  const response = await request.get('/api/v1/parcels');
  expect(response.status()).toBe(401);
  expect(response.headers()['cache-control']).toBe('no-store');
  const mutation = await request.post('/api/v1/parcels', {
    headers: { origin: 'https://evil.example' },
    data: {},
  });
  expect(mutation.status()).toBe(403);
});

test('a server account change cannot reopen the previous user’s offline cache', async ({
  page,
  context,
}) => {
  const { password } = JSON.parse(
    await readFile('.local/demo-credentials.json', 'utf8'),
  );
  await page.goto('/');
  await page.getByLabel('Correo').fill('tecnico@chira.test');
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.getByRole('button', { name: 'Preparar trabajo offline' }).click();
  await expect(
    page.getByRole('heading', { name: 'La Ribera · Demo', exact: true }),
  ).toBeVisible();
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Nueva inspección' }).first().click();
  await page
    .getByLabel('Observaciones')
    .fill('Borrador privado que no debe cambiar de autor');
  await page.getByLabel('Completé el protocolo de bioseguridad').check();
  await page
    .getByRole('button', { name: 'Guardar en este dispositivo' })
    .click();
  await expect(
    page.getByText('Pendiente de sincronizar', { exact: true }),
  ).toBeVisible();
  let mutations = 0;
  page.on('request', (request) => {
    if (
      request.method() === 'PUT' &&
      request.url().includes('/api/v1/inspections/')
    )
      mutations++;
  });
  const signIn = () =>
    context.request.post('/api/auth/sign-in/email', {
      headers: { origin: 'http://localhost:5173' },
      data: { email: 'coordinador@chira.test', password },
    });
  let response = await signIn();
  if (response.status() === 429) {
    // Exercise the production limiter rather than disabling it for browser tests.
    const retrySeconds = Math.min(
      15,
      Math.max(1, Number(response.headers()['x-retry-after'] ?? 10)),
    );
    await page.waitForTimeout(retrySeconds * 1000 + 100);
    response = await signIn();
  }
  expect(response.status()).toBe(200);
  await context.setOffline(false);
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Entrar', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Técnico de demostración', { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText('La Ribera · Demo', { exact: true })).toHaveCount(
    0,
  );
  expect(mutations).toBe(0);
});

test('offline logout survives closing a tab and revokes the cookie on reconnect', async ({
  page,
  context,
}) => {
  const { password } = JSON.parse(
    await readFile('.local/demo-credentials.json', 'utf8'),
  );
  await page.goto('/');
  await page.getByLabel('Correo').fill('tecnico@chira.test');
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.getByRole('button', { name: 'Preparar trabajo offline' }).click();
  await expect(
    page.getByRole('heading', { name: 'La Ribera · Demo', exact: true }),
  ).toBeVisible();
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Salir' }).click();
  await expect(
    page.getByRole('button', { name: 'Entrar', exact: true }),
  ).toBeVisible();
  await page.close();
  await context.setOffline(false);
  const reopened = await context.newPage();
  await reopened.goto('/');
  await expect(
    reopened.getByRole('button', { name: 'Entrar', exact: true }),
  ).toBeVisible();
  expect((await context.request.get('/api/v1/session')).status()).toBe(401);
  expect(
    await reopened.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((ok, fail) => {
        const r = indexedDB.open('chira-guardian');
        r.onsuccess = () => ok(r.result);
        r.onerror = () => fail(r.error);
      });
      if (!db.objectStoreNames.contains('parcels')) {
        db.close();
        return 0;
      }
      return new Promise<number>((ok) => {
        const r = db.transaction('parcels').objectStore('parcels').count();
        r.onsuccess = () => {
          db.close();
          ok(r.result);
        };
      });
    }),
  ).toBe(0);
});

test('phone photos over the upload limit are stored at the size the server accepts', async ({
  page,
}) => {
  const { password } = JSON.parse(
    await readFile('.local/demo-credentials.json', 'utf8'),
  );
  await page.goto('/');
  await page.getByLabel('Correo').fill('tecnico@chira.test');
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.getByRole('button', { name: 'Preparar trabajo offline' }).click();
  await expect(
    page.getByText('Parcelas disponibles sin conexión'),
  ).toBeVisible();

  // Two real failure modes of a phone camera. 8064x6048 is 48 MP, which the API
  // rejects through limitInputPixels: 20_000_000. Noise at 12 MP weighs more
  // than 8 MB, which the old client check rejected before it ever got there.
  const manyPixels = await sharp({
    create: { width: 8064, height: 6048, channels: 3, background: '#24734b' },
  })
    .jpeg({ quality: 92 })
    .toBuffer();
  const heavy = await sharp(randomBytes(3024 * 4032 * 3), {
    raw: { width: 3024, height: 4032, channels: 3 },
  })
    .jpeg({ quality: 92 })
    .toBuffer();
  expect(heavy.length).toBeGreaterThan(8 * 1024 * 1024);

  await page.getByRole('button', { name: 'Nueva inspección' }).first().click();
  await page.getByLabel('Observaciones').fill('Fotos de cámara de teléfono');
  await page.getByLabel('Completé el protocolo de bioseguridad').check();
  await page.getByLabel('Fotografías').setInputFiles([
    { name: '48mp.jpg', mimeType: 'image/jpeg', buffer: manyPixels },
    { name: 'pesada.jpg', mimeType: 'image/jpeg', buffer: heavy },
  ]);
  await page
    .getByRole('button', { name: 'Guardar en este dispositivo' })
    .click();
  await expect(
    page.getByText('Pendiente de sincronizar', { exact: true }),
  ).toBeVisible();

  const stored = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((ok, fail) => {
      const r = indexedDB.open('chira-guardian');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => fail(r.error);
    });
    const draft = await new Promise<{
      photos: { blob: Blob }[];
    }>((ok, fail) => {
      const r = db.transaction('drafts').objectStore('drafts').getAll();
      r.onsuccess = () => ok(r.result[0]);
      r.onerror = () => fail(r.error);
    });
    db.close();
    return Promise.all(
      draft.photos.map(async ({ blob }) => {
        const bitmap = await createImageBitmap(blob);
        const size = { width: bitmap.width, height: bitmap.height };
        bitmap.close();
        return { ...size, type: blob.type, bytes: blob.size };
      }),
    );
  });

  expect(stored).toHaveLength(2);
  for (const photo of stored) {
    expect(photo.type).toBe('image/webp');
    expect(Math.max(photo.width, photo.height)).toBeLessThanOrEqual(2048);
    expect(photo.width * photo.height).toBeLessThan(20_000_000);
    expect(photo.bytes).toBeLessThan(8 * 1024 * 1024);
  }
  expect(stored[0]).toMatchObject({ width: 2048, height: 1536 });
  expect(stored[1]).toMatchObject({ width: 1536, height: 2048 });
});
