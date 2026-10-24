/**
 * Provisions a pilot account from the command line. The password is generated
 * here, printed once and never written to a file: whoever runs this has to
 * hand it to the technician and cannot recover it afterwards.
 */
import { randomBytes } from 'node:crypto';
import { Pool } from 'pg';
import {
  describeUsage,
  parseUserArgs,
  validateUserInput,
} from './lib/user-input.ts';
import { provisionUser } from './lib/user-provision.ts';

let input;
try {
  input = parseUserArgs(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error(describeUsage());
  process.exit(2);
}
const errors = validateUserInput(input);
if (errors.length > 0) {
  console.error(errors.join('\n'));
  console.error(describeUsage());
  process.exit(2);
}
const url = process.env.DATABASE_ADMIN_URL;
if (!url) throw new Error('DATABASE_ADMIN_URL is required');
if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1', 'db'].includes(new URL(url).hostname)
)
  throw new Error(
    'Account provisioning only permitted on the local pilot database',
  );

const password = randomBytes(20).toString('base64url');
const pool = new Pool({ connectionString: url });
try {
  const created = await provisionUser(pool, input, password);
  console.log(`Created ${input.email}`);
  console.log(`  name: ${input.name}`);
  console.log(`  role: ${input.role}`);
  console.log(
    `  association: ${created.associationName} (${created.associationId})`,
  );
  console.log(`  password: ${password}`);
  console.log(
    'Write the password down now: it is not stored and cannot be recovered.',
  );
} finally {
  await pool.end();
}
