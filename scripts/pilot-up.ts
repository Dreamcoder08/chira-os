/**
 * Brings the field pilot origin up in one command.
 *
 * The LAN address changes, the Caddy certificate is bound to that address and
 * the API has to be told the matching origin. Doing those three by hand has
 * already broken two rehearsals, so this derives the address, restarts the API,
 * recreates the proxy, refreshes the exported root certificate for the phone and
 * proves the origin answers before anyone stands in a field.
 */
import { execFileSync, spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  openSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { dirname } from 'node:path';
import {
  buildOrigin,
  isLanAddress,
  parseListeningPid,
  parseSourceAddress,
} from './pilot/net.ts';

const host = process.env.PILOT_HOST ?? detectAddress();
const port = process.env.PILOT_PORT ?? '8443';
const apiPort = process.env.PILOT_API_PORT ?? '3001';
const origin = buildOrigin(host, port);
const caFile = '.local/pki/root.crt';
const apiLog = '.local/pilot-api.log';

function detectAddress(): string {
  const route = execFileSync('ip', ['-4', 'route', 'get', '1.1.1.1'], {
    encoding: 'utf8',
  });
  const address = parseSourceAddress(route);
  if (address === null)
    fail('could not read the LAN address; pass PILOT_HOST explicitly');
  return address;
}

function fail(message: string): never {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

function run(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv = {},
): string {
  return execFileSync(command, args, {
    encoding: 'utf8',
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function httpStatus(url: string): Promise<number> {
  return new Promise((resolve) => {
    const request = httpRequest(url, { method: 'GET', timeout: 2000 });
    request.on('response', (response) => {
      response.resume();
      resolve(response.statusCode ?? 0);
    });
    request.on('timeout', () => request.destroy(new Error('timeout')));
    request.on('error', () => resolve(0));
    request.end();
  });
}

function httpsStatus(url: string): Promise<number> {
  return new Promise((resolve) => {
    const request = httpsRequest(url, {
      method: 'GET',
      timeout: 5000,
      rejectUnauthorized: false,
    });
    request.on('response', (response) => {
      response.resume();
      resolve(response.statusCode ?? 0);
    });
    request.on('timeout', () => request.destroy(new Error('timeout')));
    request.on('error', () => resolve(0));
    request.end();
  });
}

async function waitFor(
  label: string,
  probe: () => Promise<number>,
  expected: number,
  timeoutMs = 40000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if ((await probe()) === expected) {
      console.log(`ok   ${label}`);
      return;
    }
    if (Date.now() > deadline) {
      if (existsSync(apiLog))
        console.error(
          `--- ${apiLog} (last lines)\n${run('tail', ['-n', '20', apiLog])}`,
        );
      fail(`${label} did not answer ${expected} within ${timeoutMs / 1000}s`);
    }
    await sleep(500);
  }
}

function stopApi(): void {
  let listing = '';
  try {
    listing = run('ss', ['-ltnp', `sport = :${apiPort}`]);
  } catch {
    listing = '';
  }
  const pid = parseListeningPid(listing);
  if (pid === null) {
    console.log(`ok   nothing listening on ${apiPort}`);
    return;
  }
  // The API has hung once holding the socket without answering (a stuck event
  // loop), and it ignored SIGTERM then; escalating is the difference between a
  // usable pilot and a session cancelled at the parcel.
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    // Already gone.
  }
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0);
    } catch {
      console.log(`ok   old API ${pid} stopped on SIGTERM`);
      return;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  try {
    process.kill(pid, 'SIGKILL');
    console.log(`ok   old API ${pid} needed SIGKILL`);
  } catch {
    console.log(`ok   old API ${pid} exited while escalating`);
  }
}

function startApi(): void {
  mkdirSync(dirname(apiLog), { recursive: true });
  const log = openSync(apiLog, 'a');
  const child = spawn('pnpm', ['start'], {
    detached: true,
    stdio: ['ignore', log, log],
    env: { ...process.env, APP_ORIGIN: origin },
  });
  child.unref();
  console.log(
    `ok   API starting as pid ${child.pid ?? 'unknown'} for ${origin}`,
  );
}

function ensureDatabase(): void {
  run('docker', ['compose', 'up', '-d', 'db'], process.env);
  const deadline = Date.now() + 60000;
  for (;;) {
    let health = '';
    try {
      health = run('docker', [
        'inspect',
        '-f',
        '{{.State.Health.Status}}',
        'chira-os-db-1',
      ]).trim();
    } catch {
      health = '';
    }
    if (health === 'healthy') {
      console.log('ok   database healthy');
      return;
    }
    if (Date.now() > deadline)
      fail(`database health is "${health || 'unknown'}"`);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
}

function exportRootCertificate(): void {
  mkdirSync(dirname(caFile), { recursive: true });
  rmSync(caFile, { force: true });
  const certificate = run('docker', [
    'compose',
    'exec',
    '-T',
    'proxy',
    'cat',
    '/data/caddy/pki/authorities/local/root.crt',
  ]);
  if (!certificate.includes('BEGIN CERTIFICATE'))
    fail('the proxy did not hand over its root certificate');
  // Refresh it on every start: a recreated CA would otherwise leave the phone
  // trusting a root that no longer signs the certificate the proxy serves.
  writeFileSync(caFile, certificate);
  console.log(`ok   root certificate exported to ${caFile}`);
}

async function main(): Promise<void> {
  if (!isLanAddress(host))
    fail(`${host} is not a LAN address a phone could reach`);
  console.log(`origin ${origin}`);

  if (!existsSync('apps/web/dist/index.html')) {
    console.log('     building the web shell first');
    execFileSync('pnpm', ['build'], { stdio: 'inherit' });
  }

  ensureDatabase();
  stopApi();
  startApi();
  await waitFor(
    'API answers 401 without a cookie',
    () => httpStatus(`http://127.0.0.1:${apiPort}/api/v1/session`),
    401,
  );

  run(
    'docker',
    ['compose', '--profile', 'pilot', 'up', '-d', '--force-recreate', 'proxy'],
    {
      PILOT_HOST: host,
      PILOT_PORT: port,
    },
  );
  await waitFor('proxy serves the shell', () => httpsStatus(`${origin}/`), 200);

  exportRootCertificate();

  console.log(`\npilot ready at ${origin}`);
  console.log(`root certificate for the phone: ${caFile}`);
  console.log(`verify it with: PILOT_HOST=${host} pnpm pilot:check`);
}

await main();
