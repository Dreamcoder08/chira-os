import { spawn } from 'node:child_process';
import { open, mkdir, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { verifyBackup } from './backup-integrity.ts';
import sharp from 'sharp';

const folder = process.argv[2];
if (!folder) throw new Error('Usage: pnpm restore:check <backup-directory>');
const source = resolve(folder);
const checkDb = `chira_restore_${Date.now()}`;
const databaseUrl = new URL(process.env.DATABASE_ADMIN_URL!);
if (!['127.0.0.1', 'localhost'].includes(databaseUrl.hostname))
  throw new Error('Restore checks require a local development database');
const admin = new Pool({ connectionString: databaseUrl.href });
let restored: Pool | undefined;
const destination = resolve(`.local/restore-check/${checkDb}`);
try {
  await verifyBackup(source);
  await admin.query(`CREATE DATABASE ${checkDb}`);
  const input = await open(`${source}/database.dump`, 'r');
  try {
    await new Promise<void>((ok, fail) => {
      const child = spawn(
        'docker',
        [
          'compose',
          'exec',
          '-T',
          'db',
          'pg_restore',
          '-U',
          'postgres',
          '-d',
          checkDb,
          '--exit-on-error',
        ],
        { stdio: [input.fd, 'ignore', 'inherit'] },
      );
      child.on('error', fail);
      child.on('exit', (code) =>
        code === 0 ? ok() : fail(new Error('Database restore failed')),
      );
    });
  } finally {
    await input.close();
  }
  databaseUrl.pathname = `/${checkDb}`;
  restored = new Pool({ connectionString: databaseUrl.href });
  const counts = await restored.query(
    'SELECT (SELECT count(*)::int FROM parcels) AS parcels,(SELECT count(*)::int FROM inspections) AS inspections',
  );
  const photoKeys = (
    await restored.query<{ storage_key: string }>(
      'SELECT storage_key FROM photos',
    )
  ).rows;
  await mkdir(destination, { recursive: true, mode: 0o700 });
  // Only restore archives produced locally by backup.ts; never accept an untrusted tar.
  await new Promise<void>((ok, fail) => {
    const child = spawn(
      'tar',
      ['-xf', `${source}/photos.tar`, '-C', destination],
      { stdio: 'inherit' },
    );
    child.on('error', fail);
    child.on('exit', (code) =>
      code === 0 ? ok() : fail(new Error('Photo restore failed')),
    );
  });
  for (const row of photoKeys) {
    if (
      !/^[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.webp$/.test(
        row.storage_key,
      )
    )
      throw new Error('Invalid restored photo key');
    const photo = await readFile(resolve(destination, row.storage_key));
    const metadata = await sharp(photo).metadata();
    if (metadata.format !== 'webp' || !metadata.width || !metadata.height)
      throw new Error('Invalid restored photograph');
  }
  console.log(
    JSON.stringify({
      status: 'restored-and-verified',
      ...counts.rows[0],
      photographs: photoKeys.length,
    }),
  );
} finally {
  await restored?.end();
  await admin.query(`DROP DATABASE IF EXISTS ${checkDb}`);
  await admin.end();
  await rm(destination, { recursive: true, force: true });
}
