import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

export default defineConfig({
  plugins: [
    react(),
    tailwind(),
    {
      name: 'guardian-offline-shell',
      async writeBundle(options, bundle) {
        const output = resolve(options.dir!);
        const assets = [
          ...new Set([
            '/',
            '/index.html',
            '/icon.svg',
            '/manifest.webmanifest',
            ...Object.keys(bundle)
              .filter((name) => !name.endsWith('.map'))
              .map((name) => `/${name}`),
          ]),
        ];
        const hash = createHash('sha256')
          .update(JSON.stringify(assets))
          .digest('hex')
          .slice(0, 12);
        const source = await readFile(resolve('apps/web/public/sw.js'), 'utf8');
        await writeFile(
          resolve(output, 'sw.js'),
          source
            .replace(
              /const PRECACHE = \[[\s\S]*?\];/,
              `const PRECACHE = ${JSON.stringify(assets)};`,
            )
            .replace('guardian-shell-v1', `guardian-shell-${hash}`),
        );
      },
    },
  ],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    allowedHosts: ['localhost'],
    proxy: {
      '/api': 'http://127.0.0.1:3001',
      '/health': 'http://127.0.0.1:3001',
    },
  },
  build: { sourcemap: false, chunkSizeWarningLimit: 900 },
});
