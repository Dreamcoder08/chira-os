/**
 * Prepares everything a field session needs: one coordinator account, one
 * technician account per phone, and a synthetic parcel assigned to each
 * technician so nobody opens an empty workspace.
 *
 * The password of every account is printed once and never stored. The parcels
 * are synthetic on purpose: the pilot protocol forbids real producer data.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { buildSessionPlan, validateSessionInput } from './lib/session-plan.ts';
import { provisionUser } from './lib/user-provision.ts';

function flag(argv: string[], name: string): string | undefined {
  const inline = argv.find((argument) => argument.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const index = argv.indexOf(`--${name}`);
  return index === -1 ? undefined : argv[index + 1];
}

const argv = process.argv.slice(2);
const slug =
  flag(argv, 'slug') ??
  new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').toLowerCase();
const technicians = Number(flag(argv, 'technicians') ?? '2');
const associationName = flag(argv, 'association') ?? `Sesión ${slug}`;

const errors = validateSessionInput({ slug, technicians: Number(technicians) });
if (errors.length > 0) {
  console.error(errors.join('\n'));
  console.error(
    'Usage: pnpm pilot:session [--slug <id>] [--technicians <n>] [--association "<name>"]',
  );
  process.exit(2);
}

const url = process.env.DATABASE_ADMIN_URL;
if (!url) throw new Error('DATABASE_ADMIN_URL is required');
if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1', 'db'].includes(new URL(url).hostname)
)
  throw new Error(
    'Session preparation only permitted on the local pilot database',
  );

const plan = buildSessionPlan({ slug, technicians });
const pool = new Pool({ connectionString: url });
const passwords = new Map<string, string>();

try {
  const found = await pool.query<{ id: string; name: string }>(
    'SELECT id,name FROM associations WHERE id::text=$1 OR name=$1 ORDER BY (id::text=$1) DESC LIMIT 1',
    [associationName],
  );
  const association =
    found.rows[0] ??
    (
      await pool.query<{ id: string; name: string }>(
        'INSERT INTO associations(id,name) VALUES($1,$2) RETURNING id,name',
        [randomUUID(), associationName],
      )
    ).rows[0]!;

  async function createAccount(account: (typeof plan.accounts)[number]) {
    const password = randomBytes(20).toString('base64url');
    const created = await provisionUser(
      pool,
      { ...account, association: association.id },
      password,
    );
    passwords.set(account.email, password);
    return created;
  }

  const coordinator = plan.accounts.find(
    (account) => account.role === 'coordinator',
  );
  if (!coordinator) throw new Error('The plan has no coordinator');
  await createAccount(coordinator);

  for (const parcel of plan.parcels) {
    const account = plan.accounts.find(
      (candidate) =>
        candidate.email === `${slug}-tec${parcel.technician}@chira.local`,
    );
    if (!account) throw new Error(`No account for parcel ${parcel.name}`);
    const { userId: assignedTo } = await createAccount(account);
    await pool.query(
      `INSERT INTO parcels(id,association_id,name,producer_name,crop,hectares,location,assigned_to)
       VALUES($1,$2,$3,$4,$5,$6,ST_SetSRID(ST_MakePoint($7,$8),4326),$9)`,
      [
        randomUUID(),
        association.id,
        parcel.name,
        parcel.producerName,
        parcel.crop,
        parcel.hectares,
        parcel.longitude,
        parcel.latitude,
        assignedTo,
      ],
    );
  }

  console.log(`Session ${slug} ready`);
  console.log(`  association: ${association.name} (${association.id})`);
  console.log(`  parcels:     ${plan.parcels.length} synthetic, one per phone`);
  console.log('');
  for (const account of plan.accounts)
    console.log(
      `  ${account.role.padEnd(11)} ${account.email}  ${passwords.get(account.email)}`,
    );
  console.log('');
  console.log(
    'Write these down now: passwords are not stored and cannot be recovered.',
  );
  console.log(
    'Next: install .local/pki/root.crt on each phone, serve the origin with',
  );
  console.log(
    '`pnpm pilot:up`, and print docs/pilot/consent.md and session-record.md.',
  );
} finally {
  await pool.end();
}
