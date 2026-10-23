import { mkdir, writeFile } from 'node:fs/promises';
import { createApp } from '../apps/api/src/app.ts';
import { format } from 'prettier';

process.loadEnvFile('.env');
const app = await createApp({ logger: false });
await mkdir('docs/api', { recursive: true });
await writeFile(
  'docs/api/openapi.json',
  await format(JSON.stringify(app.swagger()), { parser: 'json' }),
);
await app.close();
