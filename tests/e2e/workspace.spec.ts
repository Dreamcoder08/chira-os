import { expect, test, type Page } from '@playwright/test';

const parcels = ['Los Mangos', 'El Palmar'].map((name, index) => ({
  id: `00000000-0000-4000-8000-00000000000${index + 1}`,
  name,
  producerName: index ? 'Luis Prado' : 'Ana Rivera',
  crop: index ? 'Mango' : 'Banano',
  hectares: 2,
  location: { type: 'Point', coordinates: [-80.65 + index * 0.01, -4.84] },
  assignedTo: 'workspace-user',
}));

async function openWorkspace(page: Page, coordinator = true) {
  const inspections = parcels.map((parcel, index) => ({
    id: `10000000-0000-4000-8000-00000000000${index + 1}`,
    parcelId: parcel.id,
    authorId: 'workspace-user',
    notes: index ? 'Visita completada' : 'Hojas amarillas en sector norte',
    biosecurity: true,
    photoIds: [],
    status: index ? 'reviewed' : 'submitted',
    version: 1,
    observedAt: '2026-01-01T12:00:00.000Z',
  }));
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/session')
      return route.fulfill({
        json: {
          user: { id: 'workspace-user', name: 'Equipo sintético' },
          memberships: [
            {
              associationId: 'workspace-association',
              role: coordinator ? 'coordinator' : 'technician',
            },
          ],
        },
      });
    if (path === '/api/v1/parcels') return route.fulfill({ json: parcels });
    if (path === '/api/v1/inspections')
      return route.fulfill({ json: inspections });
    if (path.endsWith('/reviews')) {
      inspections[0]!.status = 'reviewed';
      return route.fulfill({ json: {} });
    }
    return route.abort();
  });
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'Sincronizar ahora' }),
  ).toBeEnabled();
  await expect(
    page.getByRole('tab', { name: 'Parcelas 2', exact: true }),
  ).toBeVisible();
}

function navigation(page: Page, mobile: boolean) {
  return page.getByRole('navigation', {
    name: mobile ? 'Navegación' : 'Principal',
    exact: true,
  });
}

test('filters show local results, queue counts and reset without requests', async ({
  page,
}) => {
  await openWorkspace(page);
  await expect(page.getByText('Por revisar: 1', { exact: true })).toBeVisible();
  const search = page.getByRole('searchbox', { name: 'Buscar inspecciones' });
  let requests = 0;
  page.on('request', (request) => {
    if (request.url().includes('/api/')) requests++;
  });
  await search.fill('HOJAS');
  await expect(
    page.getByText('1 de 2 registros', { exact: true }),
  ).toBeVisible();
  await page.getByLabel('Estado de inspección').selectOption('reviewed');
  await expect(
    page.getByText('Sin resultados con estos filtros.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(search).toHaveValue('');
  await expect(
    page.getByText('2 de 2 registros', { exact: true }),
  ).toBeVisible();
  await page.getByLabel('Estado de inspección').selectOption('submitted');
  await expect(
    page.getByRole('button', { name: 'Registrar revisión' }),
  ).toBeVisible();
  expect(requests).toBe(0);
});

test('lists are readable, navigation is labeled and previous entrypoints remain usable', async ({
  page,
}, testInfo) => {
  await openWorkspace(page);
  const mobile = testInfo.project.name === 'mobile';
  const nav = navigation(page, mobile);
  await expect(
    nav.getByText(mobile ? 'Revisión' : 'Inspecciones', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Mapa de ubicación de parcelas')).toHaveCount(0);
  await page
    .getByLabel('Revisión del coordinador')
    .fill('Revisado por el equipo');
  await page.getByRole('button', { name: 'Registrar revisión' }).click();
  await expect(
    page.getByRole('button', { name: 'Registrar revisión' }),
  ).toHaveCount(0);
  await nav
    .getByText(mobile ? 'Parcelas' : 'Mis parcelas', { exact: true })
    .click();
  await page.getByRole('searchbox', { name: 'Buscar parcelas' }).fill('rivera');
  await expect(
    page.getByRole('heading', { name: 'Los Mangos', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'El Palmar', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(
    page.getByRole('heading', { name: 'El Palmar', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Registrar parcela' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Registrar parcela' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Registrar parcela' }),
  ).toBeFocused();
  const lastAction = page
    .getByRole('button', { name: 'Nueva inspección', exact: true })
    .last();
  await lastAction.scrollIntoViewIfNeeded();
  const action = await lastAction.boundingBox();
  expect(action!.y + action!.height).toBeLessThan(
    page.viewportSize()!.height - (mobile ? 60 : 0),
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole('link', { name: 'Exportar inspecciones', exact: true })
    .scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Ver Los Mangos en el mapa' }).click();
  await expect(page.getByLabel('Mapa de ubicación de parcelas')).toBeVisible();
  await nav
    .getByText(mobile ? 'Revisión' : 'Inspecciones', { exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Registro de campo' }),
  ).toBeVisible();
});

test('offline capture shows pending work separately from network availability', async ({
  page,
}, testInfo) => {
  await openWorkspace(page, false);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(page.getByText('Sin conexión', { exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: 'Nueva inspección', exact: true })
    .first()
    .click();
  await page
    .getByLabel('Observaciones', { exact: true })
    .fill('Registro local sintético');
  await page.getByLabel('Completé el protocolo de bioseguridad').check();
  await page
    .getByRole('button', { name: 'Guardar en este dispositivo' })
    .click();
  await expect(
    page.getByText('En este dispositivo: 1', { exact: true }),
  ).toBeVisible();
  const pending = page.getByText('1 envío pendiente en este dispositivo', {
    exact: true,
  });
  await expect(pending).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Sincronizar ahora' }),
  ).toBeDisabled();
  await page.getByLabel('Estado de inspección').selectOption('pending');
  await expect(
    page.getByText('1 de 3 registros', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Registro local sintético', { exact: true }),
  ).toBeVisible();
  // A connection event is not proof of delivery: the fixture rejects uploads.
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByText('Con conexión', { exact: true })).toBeVisible();
  await expect(pending).toBeVisible();
  await navigation(page, testInfo.project.name === 'mobile')
    .getByText('Mapa', { exact: true })
    .click();
  await expect(page.getByLabel('Mapa de ubicación de parcelas')).toBeVisible();
});
