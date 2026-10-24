import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  checkoutHasLocalChanges,
  git,
} from '../../scripts/lib/git-checkout.js';

const scratch: string[] = [];

async function scratchDir(prefix: string) {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  scratch.push(dir);
  return dir;
}

async function repositoryWithOneCommit() {
  const dir = await scratchDir('chira-git-source-');
  git(['init', '-q', dir]);
  git(
    [
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@chira.test',
      'commit',
      '-q',
      '--allow-empty',
      '-m',
      'init',
    ],
    dir,
  );
  await writeFile(join(dir, 'tracked.txt'), 'content\n');
  git(['add', 'tracked.txt'], dir);
  git(
    [
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@chira.test',
      'commit',
      '-q',
      '-m',
      'add',
    ],
    dir,
  );
  return dir;
}

afterEach(async () => {
  await Promise.all(
    scratch.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe('git checkout inspection', () => {
  it('treats a fresh --no-checkout clone as populated only after checkout', async () => {
    const source = await repositoryWithOneCommit();
    const clone = join(await scratchDir('chira-git-clone-'), 'archify');
    git(['clone', '-q', '--no-checkout', source, clone]);

    // The trap that broke CI: an empty index reports every tracked file as deleted.
    expect(checkoutHasLocalChanges(clone)).toBe(true);

    git(['checkout', '-q', '--detach', 'HEAD'], clone);
    expect(checkoutHasLocalChanges(clone)).toBe(false);
  });

  it('reports a real modification in a populated checkout', async () => {
    const source = await repositoryWithOneCommit();
    const clone = join(await scratchDir('chira-git-clone-'), 'archify');
    git(['clone', '-q', source, clone]);
    expect(checkoutHasLocalChanges(clone)).toBe(false);

    await writeFile(join(clone, 'tracked.txt'), 'changed\n');
    expect(checkoutHasLocalChanges(clone)).toBe(true);
  });
});
