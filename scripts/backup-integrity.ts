import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const files = ['database.dump', 'photos.tar'] as const;
async function digest(path: string) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
export async function sealBackup(directory: string): Promise<void> {
  const hashes = Object.fromEntries(
    await Promise.all(
      files.map(async (name) => [name, await digest(join(directory, name))]),
    ),
  );
  await writeFile(
    join(directory, 'manifest.json'),
    JSON.stringify(
      {
        version: 1,
        createdAt: new Date().toISOString(),
        maintenanceWindowRequired: true,
        sha256: hashes,
      },
      null,
      2,
    ) + '\n',
    { mode: 0o600 },
  );
}
export async function verifyBackup(directory: string): Promise<void> {
  const manifest = JSON.parse(
    await readFile(join(directory, 'manifest.json'), 'utf8'),
  );
  for (const name of files)
    if (
      typeof manifest.sha256?.[name] !== 'string' ||
      (await digest(join(directory, name))) !== manifest.sha256[name]
    )
      throw new Error('BACKUP_INTEGRITY_FAILED');
}
