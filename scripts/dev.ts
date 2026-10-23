import { spawn } from 'node:child_process';

const processes = [
  spawn('pnpm', ['exec', 'tsx', '--env-file=.env', 'apps/api/src/main.ts'], {
    stdio: 'inherit',
  }),
  spawn('pnpm', ['exec', 'vite', 'apps/web', '--host', '127.0.0.1'], {
    stdio: 'inherit',
  }),
];
function stop() {
  for (const child of processes) child.kill('SIGTERM');
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, stop);
for (const child of processes)
  child.once('exit', (code) => {
    stop();
    process.exitCode = code ?? 0;
  });
