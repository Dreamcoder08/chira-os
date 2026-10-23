import { spawnSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

// Reviewed source revision; no installer, global configuration or automatic updates.
const revision = '25cf37080fc8b1dbe758a4efc3935b55f3327083';
const target = '.local/tools/archify';
function git(args: string[]) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}
await mkdir('.local/tools', { recursive: true, mode: 0o700 });
if (!existsSync(target))
  git([
    'clone',
    '--no-checkout',
    'https://github.com/tt-a1i/archify.git',
    target,
  ]);
if (git(['-C', target, 'status', '--porcelain']))
  throw new Error(
    'Archify checkout has local changes; inspect them before proceeding.',
  );
git(['-C', target, 'checkout', '--detach', revision]);
if (git(['-C', target, 'rev-parse', 'HEAD']) !== revision)
  throw new Error('Archify revision mismatch');
console.log(
  `Archify ready at reviewed revision ${revision}. No production credentials are needed.`,
);
