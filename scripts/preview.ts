import { createApp } from '../apps/api/src/app.ts';

const app = await createApp();
await app.listen({ host: '127.0.0.1', port: 5173 });
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, async () => {
    await app.close();
    process.exit(0);
  });
