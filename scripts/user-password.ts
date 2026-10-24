/**
 * Replaces the password of a pilot account from the command line. The pilot has
 * no email delivery, so this is the only way back in when a technician forgets
 * the password. The new password is printed once, never written to a file, and
 * every session of that account is closed.
 */
import { randomBytes } from 'node:crypto';
import { Pool } from 'pg';
import {
  describePasswordUsage,
  parsePasswordArgs,
  validatePasswordResetInput,
} from './lib/user-input.ts';
import { resetUserPassword } from './lib/user-provision.ts';

let input;
try {
  input = parsePasswordArgs(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error(describePasswordUsage());
  process.exit(2);
}
const errors = validatePasswordResetInput(input);
if (errors.length > 0) {
  console.error(errors.join('\n'));
  console.error(describePasswordUsage());
  process.exit(2);
}
const url = process.env.DATABASE_ADMIN_URL;
if (!url) throw new Error('DATABASE_ADMIN_URL is required');
if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1', 'db'].includes(new URL(url).hostname)
)
  throw new Error('Password reset only permitted on the local pilot database');

const password = randomBytes(20).toString('base64url');
const pool = new Pool({ connectionString: url });
try {
  const reset = await resetUserPassword(pool, input.email, password);
  console.log(`Reset password for ${input.email}`);
  console.log(`  name: ${reset.name}`);
  console.log(`  role: ${reset.role}`);
  console.log(`  association: ${reset.associationName}`);
  console.log(`  closed sessions: ${reset.revokedSessions}`);
  console.log(`  password: ${password}`);
  console.log(
    'Write the password down now: it is not stored and cannot be recovered.',
  );
} finally {
  await pool.end();
}
