import { tmpdir } from 'node:os';
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'workspace.spec.ts',
  outputDir: `${tmpdir()}/chira-workspace-results-${process.pid}`,
  reporter: 'list',
  workers: 1,
  timeout: 12000,
  expect: { timeout: 3000 },
  use: {
    baseURL: 'http://127.0.0.1:5187',
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `node --input-type=module -e "import { createServer } from 'vite'; import react from '@vitejs/plugin-react'; import tailwind from '@tailwindcss/vite'; const server = await createServer({ configFile: false, envDir: false, root: 'apps/web', plugins: [react(), tailwind()], server: { host: '127.0.0.1', port: 5187, strictPort: true }, cacheDir: '${tmpdir()}/chira-workspace-vite-${process.pid}' }); await server.listen();"`,
    url: 'http://127.0.0.1:5187',
    reuseExistingServer: false,
    timeout: 10000,
  },
});
