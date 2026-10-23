import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { LocalPhotoStorage } from '../../packages/data/src/storage.ts';

const directories: string[] = [];
const key =
  '11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333.webp';
afterEach(async () => {
  for (const folder of directories.splice(0))
    await rm(folder, { recursive: true, force: true });
});
describe('immutable photo storage retries', () => {
  it('accepts identical orphan retries but rejects different confirmed bytes', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'chira-photo-'));
    directories.push(folder);
    const storage = new LocalPhotoStorage(folder);
    await storage.put(key, Buffer.from('first-complete-photo'));
    await storage.put(key, Buffer.from('first-complete-photo'));
    await expect(
      storage.put(key, Buffer.from('different-photo')),
    ).rejects.toThrow('PHOTO_STORAGE_CONFLICT');
    expect(Buffer.from(await storage.get(key)).toString()).toBe(
      'first-complete-photo',
    );
  });
  it('does not confirm a partial orphan as complete evidence', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'chira-photo-'));
    directories.push(folder);
    await mkdir(dirname(join(folder, key)), { recursive: true });
    await writeFile(join(folder, key), 'partial');
    await expect(
      new LocalPhotoStorage(folder).put(key, Buffer.from('complete-photo')),
    ).rejects.toThrow('PHOTO_STORAGE_CONFLICT');
  });
});
