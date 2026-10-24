import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { checkoutHasLocalChanges, git } from './lib/git-checkout.js';

// Reviewed source revision; no installer, global configuration or automatic updates.
const revision = '25cf37080fc8b1dbe758a4efc3935b55f3327083';
const url = 'https://github.com/tt-a1i/archify.git';
const target = '.local/tools/archify';
await mkdir('.local/tools', { recursive: true, mode: 0o700 });
const fresh = !existsSync(target);
if (fresh) git(['clone', '--no-checkout', url, target]);
// Only a populated checkout can hold local changes worth protecting; a fresh
// --no-checkout clone has an empty index and would always look dirty.
if (!fresh && checkoutHasLocalChanges(target))
  throw new Error(
    'Archify checkout has local changes; inspect them before proceeding.',
  );
git(['checkout', '--detach', revision], target);
if (checkoutHasLocalChanges(target))
  throw new Error(
    'Archify checkout is not clean after checkout; inspect it before proceeding.',
  );
if (git(['rev-parse', 'HEAD'], target) !== revision)
  throw new Error('Archify revision mismatch');
console.log(
  `Archify ready at reviewed revision ${revision}. No production credentials are needed.`,
);
