import { mkdir, readFile, open, link, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import type { PhotoStorage } from '../../domain/src/ports.ts';
import { DomainError } from '../../domain/src/guardian.ts';

function checkedKey(key: string) {
  if (!/^[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.webp$/.test(key))
    throw new Error('Invalid storage key');
  return key;
}
export class LocalPhotoStorage implements PhotoStorage {
  constructor(private readonly root: string) {}
  async put(key: string, bytes: Uint8Array) {
    const target = resolve(this.root, checkedKey(key));
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    const temporary = `${target}.${randomUUID()}.tmp`;
    const file = await open(temporary, 'wx', 0o600);
    try {
      await file.writeFile(bytes);
      await file.sync();
    } finally {
      await file.close();
    }
    try {
      // Atomic publication without overwriting another writer's evidence.
      await link(temporary, target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      if (!(await readFile(target)).equals(Buffer.from(bytes)))
        throw new DomainError('PHOTO_STORAGE_CONFLICT', 409);
    } finally {
      await unlink(temporary);
    }
  }
  async get(key: string) {
    return readFile(resolve(this.root, checkedKey(key)));
  }
}
export class S3PhotoStorage implements PhotoStorage {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
  ) {}
  async put(key: string, bytes: Uint8Array) {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: checkedKey(key),
          Body: bytes,
          ContentType: 'image/webp',
          ServerSideEncryption: 'AES256',
          IfNoneMatch: '*',
        }),
      );
    } catch (error) {
      if (
        (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode !== 412
      )
        throw error;
      if (!Buffer.from(await this.get(key)).equals(Buffer.from(bytes)))
        throw new DomainError('PHOTO_STORAGE_CONFLICT', 409);
    }
  }
  async get(key: string) {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: checkedKey(key) }),
    );
    if (!response.Body) throw new Error('Photo unavailable');
    return response.Body.transformToByteArray();
  }
}
export function makeStorage(): PhotoStorage {
  if (process.env.STORAGE_DRIVER === 's3') {
    if (!process.env.S3_BUCKET || !process.env.AWS_REGION)
      throw new Error('S3_BUCKET and AWS_REGION required');
    return new S3PhotoStorage(
      new S3Client({ region: process.env.AWS_REGION }),
      process.env.S3_BUCKET,
    );
  }
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.STORAGE_DRIVER !== 'local'
  )
    throw new Error('Select an explicit storage driver');
  return new LocalPhotoStorage(process.env.STORAGE_PATH ?? '.local/photos');
}
