import { spawnSync } from 'node:child_process';

const root = '.local/tools/archify';
const expected = '25cf37080fc8b1dbe758a4efc3935b55f3327083';
const revision = spawnSync('git', ['-C', root, 'rev-parse', 'HEAD'], {
  encoding: 'utf8',
});
const status = spawnSync('git', ['-C', root, 'status', '--porcelain'], {
  encoding: 'utf8',
});
if (
  revision.status !== 0 ||
  revision.stdout.trim() !== expected ||
  status.stdout.trim()
)
  throw new Error(
    'Run pnpm diagrams:setup; only the reviewed, unmodified revision is allowed.',
  );
const suffix = Date.now().toString();
for (const [type, name] of [
  ['architecture', 'guardian'],
  ['sequence', 'sync'],
]) {
  const result = spawnSync(
    process.execPath,
    [
      `${root}/archify/bin/archify.mjs`,
      'finalize',
      type!,
      `docs/architecture/${name}.json`,
      `docs/architecture/generated/${name}.html`,
      '--quality',
      'showcase',
      '--out-dir',
      `.local/diagram-evidence/${suffix}`,
      '--json',
    ],
    {
      encoding: 'utf8',
      env: { ...process.env, ARCHIFY_UPDATE_CHECK_DISABLED: '1' },
    },
  );
  let receipt: { ok?: boolean; gates?: unknown; diagnostics?: unknown };
  try {
    receipt = JSON.parse(result.stdout);
  } catch {
    throw new Error(result.stderr || 'Archify did not return a receipt');
  }
  console.log(
    JSON.stringify({
      diagram: name,
      ok: receipt.ok,
      gates: receipt.gates,
      diagnostics: receipt.diagnostics,
    }),
  );
  if (result.status !== 0)
    throw new Error(
      `Archify ${name} failed; inspect .local/diagram-evidence/${suffix}`,
    );
}
