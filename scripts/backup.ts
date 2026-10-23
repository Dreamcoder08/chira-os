import { spawn } from 'node:child_process';
import { mkdir, open, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sealBackup } from './backup-integrity.ts';

const target = resolve(
  process.argv[2] ??
    `.local/backups/${new Date().toISOString().replaceAll(':', '-')}`,
);
await mkdir(target, { recursive: true, mode: 0o700 });
await access(`${target}/database.dump`).then(
  () => {
    throw new Error('Backup already exists; use a new directory');
  },
  () => {},
);
async function archive(command: string, args: string[], path: string) {
  const file = await open(path, 'wx', 0o600);
  try {
    await new Promise<void>((ok, fail) => {
      const child = spawn(command, args, {
        stdio: ['ignore', file.fd, 'inherit'],
      });
      child.on('error', fail);
      child.on('exit', (code) =>
        code === 0 ? ok() : fail(new Error(`${command} exited ${code}`)),
      );
    });
  } finally {
    await file.close();
  }
}
await archive(
  'docker',
  [
    'compose',
    'exec',
    '-T',
    'db',
    'pg_dump',
    '-U',
    'postgres',
    '-d',
    'chira',
    '-Fc',
  ],
  `${target}/database.dump`,
);
const photos = resolve(process.env.STORAGE_PATH ?? '.local/photos');
await mkdir(photos, { recursive: true, mode: 0o700 });
if (process.env.BACKUP_STORAGE_MODE === 'compose') {
  await archive(
    'docker',
    [
      'run',
      '--rm',
      '--network',
      'none',
      '--read-only',
      '--user',
      '65532:65532',
      '--mount',
      'type=volume,src=chira-os_photos,dst=/photos,readonly',
      'node:24-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205',
      'tar',
      '-C',
      '/photos',
      '-cf',
      '-',
      '.',
    ],
    `${target}/photos.tar`,
  );
} else
  await archive('tar', ['-C', photos, '-cf', '-', '.'], `${target}/photos.tar`);
await sealBackup(target);
console.log(`Backup completed: ${target}. Protect it as confidential data.`);
