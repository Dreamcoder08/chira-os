import { afterEach, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sealBackup, verifyBackup } from '../../scripts/backup-integrity.ts';

let directory = '';
afterEach(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});
it('rejects corruption before attempting to restore a nonempty archive', async () => {
  directory = await mkdtemp(join(tmpdir(), 'chira-backup-'));
  await writeFile(join(directory, 'database.dump'), 'valid-database');
  await writeFile(join(directory, 'photos.tar'), 'valid-photo-archive');
  await sealBackup(directory);
  await verifyBackup(directory);
  await writeFile(join(directory, 'photos.tar'), 'nonempty-corrupt-archive');
  await expect(verifyBackup(directory)).rejects.toThrow(
    'BACKUP_INTEGRITY_FAILED',
  );
});
