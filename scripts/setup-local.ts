import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, access } from 'node:fs/promises';

await mkdir('.local', { recursive: true, mode: 0o700 });
try {
  await access('.env');
  console.log('.env already exists; kept unchanged.');
} catch {
  const admin = randomBytes(24).toString('hex');
  const app = randomBytes(24).toString('hex');
  const auth = randomBytes(24).toString('hex');
  const worker = randomBytes(24).toString('hex');
  await writeFile(
    '.env',
    [
      `POSTGRES_PASSWORD=${admin}`,
      `APP_DB_PASSWORD=${app}`,
      `AUTH_DB_PASSWORD=${auth}`,
      `WORKER_DB_PASSWORD=${worker}`,
      `DATABASE_ADMIN_URL=postgres://postgres:${admin}@127.0.0.1:5432/chira`,
      `DATABASE_URL=postgres://chira_app:${app}@127.0.0.1:5432/chira`,
      `AUTH_DATABASE_URL=postgres://chira_auth:${auth}@127.0.0.1:5432/chira`,
      `WORKER_DATABASE_URL=postgres://chira_worker:${worker}@127.0.0.1:5432/chira`,
      `BETTER_AUTH_SECRET=${randomBytes(48).toString('hex')}`,
      'APP_ORIGIN=http://localhost:5173',
      'PORT=3001',
      'HOST=127.0.0.1',
      'STORAGE_PATH=.local/photos',
      'STORAGE_DRIVER=local',
      'NODE_ENV=development',
      '',
    ].join('\n'),
    { mode: 0o600 },
  );
  console.log('Generated local .env with unique credentials. Never commit it.');
}
