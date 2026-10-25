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

async function openWorkspace(
  page: Page,
  coordinator = true,
  workspaceParcels = parcels,
) {
  const inspections = workspaceParcels.map((parcel, index) => ({
    id: `10000000-0000-4000-8000-00000000000${index + 1}`,
    parcelId: parcel.id,
    authorId: 'workspace-user',
    notes: index ? 'Visita completada' : 'Hojas amarillas en sector norte',
    biosecurity: true,
    photoIds: [],
    status: index ? 'reviewed' : 'submitted',
    version: 1,
    observedAt: '2026-01-01T12:00:00.000Z',
    sampling: index ? null : { plantsObserved: 40, plantsAffected: 3 },
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
    if (path === '/api/v1/parcels')
      return route.fulfill({ json: workspaceParcels });
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
    page.getByRole('tab', {
      name: `Parcelas ${workspaceParcels.length}`,
      exact: true,
    }),
  ).toBeVisible();
}

function navigation(page: Page, mobile: boolean) {
  return page.getByRole('navigation', {
    name: mobile ? 'Navegación' : 'Principal',
    exact: true,
  });
}

// A coordinator lands on the review list. The rail owns navigation on a wide
// screen and is hidden on a phone, where the tab bar does the same job.
async function openParcelList(page: Page): Promise<void> {
  const rail = page.getByRole('link', { name: 'Mis parcelas', exact: true });
  if (await rail.isVisible()) await rail.click();
  else
    await page.getByRole('button', { name: 'Parcelas', exact: true }).click();
}

test('secondary metrics expand by keyboard without hiding pending work', async ({
  page,
}) => {
  await openWorkspace(page);
  await expect(
    page.getByText('2 de 2 registros', { exact: true }),
  ).toBeVisible();
  let requests = 0;
  page.on('request', (request) => {
    if (request.url().includes('/api/')) requests++;
  });
  const metrics = page.getByLabel('Resumen del equipo', { exact: true });
  const toggle = metrics.locator('summary');
  await expect(toggle).toBeVisible();
  await expect(metrics.getByText('SUPERFICIE REGISTRADA')).toBeHidden();
  await expect(
    page.getByText('Sin envíos locales pendientes', { exact: true }),
  ).toBeVisible();
  await toggle.focus();
  await toggle.press('Enter');
  await expect(metrics.getByText('SUPERFICIE REGISTRADA')).toBeVisible();
  await expect(metrics.getByText('02', { exact: true })).toBeVisible();
  await expect(metrics.getByText('4 ha', { exact: true })).toBeVisible();
  await expect(metrics.getByText('00', { exact: true })).toBeVisible();
  await toggle.press('Enter');
  await expect(metrics.getByText('SUPERFICIE REGISTRADA')).toBeHidden();
  await expect(
    page.getByRole('button', { name: 'Sincronizar ahora', exact: true }),
  ).toBeEnabled();
  expect(requests).toBe(0);
});

for (const count of [1, 2]) {
  test(`field map keeps ${count} parcel labels clear of usable controls`, async ({
    page,
  }, testInfo) => {
    const visibleParcels = parcels.slice(0, count);
    await openWorkspace(page, true, visibleParcels);
    await navigation(page, testInfo.project.name === 'mobile')
      .getByText('Mapa', { exact: true })
      .click();
    const zoom = page.getByRole('button', {
      name: 'Acercar el mapa',
      exact: true,
    });
    await expect(zoom).toBeVisible();
    if (testInfo.project.name === 'mobile') {
      for (const name of [
        'Acercar el mapa',
        'Alejar el mapa',
        'Encuadrar las parcelas',
      ]) {
        const box = await page
          .getByRole('button', { name, exact: true })
          .boundingBox();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
    }
    const map = page.getByLabel('Mapa de ubicación de parcelas');
    await expect(map).toHaveAttribute('aria-busy', 'false', { timeout: 6000 });
    const zoomBox = (await zoom.boundingBox())!;
    const mapBox = (await map.boundingBox())!;
    for (const parcel of visibleParcels) {
      const label = map.getByText(parcel.name, { exact: true });
      await expect(label).toBeInViewport();
      const box = (await label.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(mapBox.x + 8);
      expect(box.x + box.width).toBeLessThanOrEqual(zoomBox.x - 8);
    }
    await page.screenshot({
      path: testInfo.outputPath(`field-map-${count}.png`),
      animations: 'disabled',
    });
  });
}

test('workspace heading is task-specific and compact on both list views', async ({
  page,
}, testInfo) => {
  await openWorkspace(page);
  const heading = page.getByRole('region', {
    name: 'Revisión de campo',
    exact: true,
  });
  await expect(heading).toBeVisible();
  expect((await heading.boundingBox())!.height).toBeLessThanOrEqual(160);
  await expect(
    heading.getByText(
      'Demostración · datos sintéticos · sin diagnóstico automático',
    ),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('inspections.png') });
  await navigation(page, testInfo.project.name === 'mobile')
    .getByText(
      testInfo.project.name === 'mobile' ? 'Parcelas' : 'Mis parcelas',
      {
        exact: true,
      },
    )
    .click();
  const parcelsHeading = page.getByRole('region', {
    name: 'Parcelas de tu equipo',
    exact: true,
  });
  await expect(parcelsHeading).toBeVisible();
  expect((await parcelsHeading.boundingBox())!.height).toBeLessThanOrEqual(160);
  await expect(
    page.getByRole('button', { name: 'Registrar parcela', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('parcels.png') });
});

test('map hides the workspace panel and restores it on return', async ({
  page,
}, testInfo) => {
  await openWorkspace(page);
  const nav = navigation(page, testInfo.project.name === 'mobile');
  await nav.getByText('Mapa', { exact: true }).click();
  await expect(page.getByLabel('Mapa de ubicación de parcelas')).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: 'Sincronizar ahora',
      exact: true,
      includeHidden: true,
    }),
  ).toBeHidden();
  await expect(
    page.getByRole('tablist', { name: 'Panel', includeHidden: true }),
  ).toBeHidden();
  await nav
    .getByText(
      testInfo.project.name === 'mobile' ? 'Revisión' : 'Inspecciones',
      {
        exact: true,
      },
    )
    .click();
  await expect(
    page.getByRole('button', { name: 'Sincronizar ahora', exact: true }),
  ).toBeEnabled();
  await expect(page.getByRole('tablist', { name: 'Panel' })).toBeVisible();
  await expect(
    page.getByText('2 de 2 registros', { exact: true }),
  ).toBeVisible();
});

test('map explains its local cartography in desktop and mobile layouts', async ({
  page,
}, testInfo) => {
  await openWorkspace(page);
  await navigation(page, testInfo.project.name === 'mobile')
    .getByText('Mapa', { exact: true })
    .click();
  const map = page.getByLabel('Mapa de ubicación de parcelas');
  await expect(map).toBeVisible();
  await expect(map.getByText('Los Mangos', { exact: true })).toBeVisible();
  await expect(
    navigation(page, testInfo.project.name === 'mobile').locator(
      '[aria-current="page"]',
    ),
  ).toHaveText('Mapa');
  const note = page.getByText(
    'Referencia geográfica local. No incluye imágenes satelitales ni cartografía base.',
    { exact: true },
  );
  await expect(note).toBeVisible();
  await expect(note).toBeInViewport();
  await page.screenshot({
    path: testInfo.outputPath('map.png'),
    animations: 'disabled',
  });
});

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

test('records a sampling count and shows incidence without claiming a diagnosis', async ({
  page,
}) => {
  await openWorkspace(page, false);
  await page
    .getByRole('button', { name: 'Nueva inspección', exact: true })
    .first()
    .click();
  await page
    .getByLabel('Observaciones', { exact: true })
    .fill('Conteo de plantas en el lote norte');
  await page.getByLabel('Completé el protocolo de bioseguridad').check();
  await page.getByLabel('Plantas evaluadas').fill('40');
  await page.getByLabel('Con síntomas').fill('5');
  await expect(page.getByText(/Incidencia 12,5/)).toBeVisible();
  await page
    .getByRole('button', { name: 'Guardar en este dispositivo' })
    .click();
  await expect(
    page.getByText('Muestreo: 5 de 40 plantas con síntomas', { exact: false }),
  ).toBeVisible();
  // The count is a number the technician observed, not a verdict: the screen
  // keeps saying that nothing here is diagnosed automatically.
  await expect(
    page.getByText('sin diagnóstico automático', { exact: false }),
  ).toBeVisible();
});

test('shows the recent visits of a parcel with their incidence', async ({
  page,
}) => {
  // A coordinator lands on the review list, so the parcel tiles are one
  // navigation step away.
  await openWorkspace(page);
  await openParcelList(page);
  await page.getByRole('button', { name: 'Ver Los Mangos en el mapa' }).click();
  const history = page.getByLabel('Historial de la parcela');
  await expect(
    history.getByText('Incidencia 7,5 %', { exact: true }),
  ).toBeVisible();
  await expect(
    history.getByText('3 de 40 plantas', { exact: true }),
  ).toBeVisible();
  await expect(history.getByText('Enviada', { exact: true })).toBeVisible();
});

test('does not offer work that is already recorded', async ({ page }) => {
  // Every fixture parcel already has one inspection, so an empty pending list
  // is correct here: the panel must not invent work to look busy.
  await openWorkspace(page);
  await expect(page.getByLabel('Trabajo pendiente')).toHaveCount(0);
});
