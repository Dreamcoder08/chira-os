/**
 * Proves the field pilot stack behaves as the runbook claims: one HTTPS origin
 * serving the built shell, the API behind it, and a service worker that takes
 * control of a phone browser. A self-signed local CA is expected, so the checks
 * accept the certificate instead of validating it; nothing here is a substitute
 * for the CA installation the runbook asks the technician to do.
 */
import { chromium } from '@playwright/test';
import { request as httpsRequest } from 'node:https';

const host = process.env.PILOT_HOST ?? 'chira.local';
const port = process.env.PILOT_PORT ?? '8443';
const origin = `https://${host}:${port}`;

type HttpResponse = {
  status: number;
  headers: Record<string, string>;
  body: string;
  issuer: string;
};
type Result = { name: string; ok: boolean; detail: string };

const results: Result[] = [];

function record(name: string, ok: boolean, detail: string): void {
  results.push({ name, ok, detail });
}

function get(path: string): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const request = httpsRequest(
      `${origin}${path}`,
      { method: 'GET', rejectUnauthorized: false, timeout: 10000 },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        const certificate = (
          response.socket as unknown as {
            getPeerCertificate(): { issuer?: { CN?: string } };
          } | null
        )?.getPeerCertificate();
        response.on('end', () => {
          resolve({
            issuer: String(certificate?.issuer?.CN ?? 'unknown'),
            status: response.statusCode ?? 0,
            headers: Object.fromEntries(
              Object.entries(response.headers).map(([key, value]) => [
                key,
                Array.isArray(value) ? value.join(', ') : (value ?? ''),
              ]),
            ),
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );
    request.on('timeout', () => request.destroy(new Error('timeout')));
    request.on('error', reject);
    request.end();
  });
}

async function checkShell(): Promise<void> {
  const response = await get('/');
  record(
    'certificate issuer',
    response.issuer.includes('Caddy'),
    response.issuer,
  );
  record(
    'GET /',
    response.status === 200 && response.body.includes('id="root"'),
    `${response.status} ${response.headers['content-type'] ?? ''}`,
  );
}

async function checkManifest(): Promise<void> {
  const response = await get('/manifest.webmanifest');
  let start = '';
  try {
    start = String(JSON.parse(response.body).start_url ?? '');
  } catch {
    start = '';
  }
  record(
    'GET /manifest.webmanifest',
    response.status === 200 && start !== '',
    `${response.status} start_url=${start || 'missing'}`,
  );
}

async function checkServiceWorker(): Promise<void> {
  const response = await get('/sw.js');
  const cacheControl = response.headers['cache-control'] ?? '';
  record(
    'GET /sw.js',
    response.status === 200 && cacheControl.includes('no-cache'),
    `${response.status} cache-control=${cacheControl || 'missing'}`,
  );
}

async function checkApi(): Promise<void> {
  const response = await get('/api/v1/session');
  record(
    'GET /api/v1/session',
    response.status === 401,
    `${response.status} (401 without a cookie proves the API is behind the proxy)`,
  );
}

async function checkBrowser(): Promise<void> {
  // Chromium refuses to register a service worker for an origin with an
  // untrusted certificate, so the browser trusts any certificate for this
  // check only; on a real phone that trust comes from installing the CA, which
  // the runbook requires.
  const browser = await chromium.launch({
    args: ['--ignore-certificate-errors'],
  });
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    await page.goto(origin, { waitUntil: 'load' });
    const state = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator))
        return { secure: window.isSecureContext, controller: null };
      const ready = await Promise.race([
        navigator.serviceWorker.ready.then(() => true),
        new Promise<boolean>((resolve) =>
          setTimeout(() => resolve(false), 15000),
        ),
      ]);
      const deadline = Date.now() + 15000;
      while (
        ready &&
        !navigator.serviceWorker.controller &&
        Date.now() < deadline
      )
        await new Promise((resolve) => setTimeout(resolve, 200));
      return {
        secure: window.isSecureContext,
        controller: navigator.serviceWorker.controller?.scriptURL ?? null,
      };
    });
    record(
      'browser secure context',
      state.secure === true,
      String(state.secure),
    );
    record(
      'service worker controls the page',
      state.controller !== null,
      state.controller ?? 'no controller',
    );
    await context.close();
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  const steps: [string, () => Promise<void>][] = [
    ['shell', checkShell],
    ['manifest', checkManifest],
    ['service worker', checkServiceWorker],
    ['api', checkApi],
    ['browser', checkBrowser],
  ];
  for (const [label, step] of steps) {
    try {
      await step();
    } catch (error) {
      record(
        label,
        false,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
  for (const result of results)
    console.log(
      `${result.ok ? 'ok  ' : 'FAIL'} ${result.name}: ${result.detail}`,
    );
  const failed = results.filter((result) => !result.ok);
  if (failed.length > 0) {
    console.error(`\n${failed.length} check(s) failed against ${origin}`);
    process.exit(1);
  }
  console.log(`\nAll checks passed against ${origin}`);
}

await main();
