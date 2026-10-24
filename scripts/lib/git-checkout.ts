import { spawnSync } from 'node:child_process';

export function git(args: string[], cwd?: string): string {
  const result = spawnSync('git', cwd ? ['-C', cwd, ...args] : args, {
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}

// A checkout created with --no-checkout has an empty index, so every tracked
// file looks deleted until the first checkout runs. Callers must only use this
// to inspect a checkout that was already populated.
export function checkoutHasLocalChanges(dir: string): boolean {
  return git(['status', '--porcelain'], dir) !== '';
}
