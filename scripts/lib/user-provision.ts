/**
 * Creates one real pilot account: the auth user, its hashed credential and the
 * membership that ties it to an association and a role. The SQL shape matches
 * scripts/seed.ts so the pilot accounts behave exactly like the demo ones.
 *
 * It also resets the password of an existing account, because the pilot has no
 * email delivery: without this, a technician who forgets the password cannot
 * enter again.
 */
import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import type { Pool } from 'pg';
import type { UserInput } from './user-input.ts';

export type CreatedUser = {
  userId: string;
  associationId: string;
  associationName: string;
};

export async function provisionUser(
  pool: Pool,
  input: UserInput,
  password: string,
): Promise<CreatedUser> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const association = await client.query<{ id: string; name: string }>(
      'SELECT id,name FROM associations WHERE id::text=$1 OR name=$1 ORDER BY (id::text=$1) DESC LIMIT 1',
      [input.association],
    );
    const target = association.rows[0];
    if (!target) throw new Error(`Association not found: ${input.association}`);
    const existing = await client.query(
      'SELECT 1 FROM auth_users WHERE email=$1',
      [input.email],
    );
    if (existing.rows.length > 0)
      throw new Error(`Email already registered: ${input.email}`);
    const userId = randomUUID();
    await client.query(
      'INSERT INTO auth_users(id,name,email,email_verified) VALUES($1,$2,$3,true)',
      [userId, input.name, input.email],
    );
    await client.query(
      "INSERT INTO auth_accounts(id,account_id,provider_id,user_id,password) VALUES($1,$2,'credential',$2,$3)",
      [randomUUID(), userId, await hashPassword(password)],
    );
    await client.query(
      'INSERT INTO memberships(association_id,user_id,role) VALUES($1,$2,$3)',
      [target.id, userId, input.role],
    );
    await client.query('COMMIT');
    return {
      userId,
      associationId: target.id,
      associationName: target.name,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export type ResetUser = {
  userId: string;
  name: string;
  role: string;
  associationName: string;
  revokedSessions: number;
};

/**
 * Replaces the password of an existing account. The previous password stops
 * working immediately and every open session is deleted, so a lost phone or a
 * shared password cannot keep using the account after the reset.
 */
export async function resetUserPassword(
  pool: Pool,
  email: string,
  password: string,
): Promise<ResetUser> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query<{ id: string; name: string }>(
      'SELECT id,name FROM auth_users WHERE email=$1',
      [email],
    );
    const target = found.rows[0];
    if (!target) throw new Error(`User not found: ${email}`);
    const membership = await client.query<{ role: string; name: string }>(
      'SELECT m.role,a.name FROM memberships m JOIN associations a ON a.id=m.association_id WHERE m.user_id=$1 ORDER BY m.role LIMIT 1',
      [target.id],
    );
    const updated = await client.query(
      "UPDATE auth_accounts SET password=$2,updated_at=now() WHERE user_id=$1 AND provider_id='credential'",
      [target.id, await hashPassword(password)],
    );
    if (updated.rowCount === 0)
      throw new Error(`No password credential for: ${email}`);
    const revoked = await client.query(
      'DELETE FROM auth_sessions WHERE user_id=$1',
      [target.id],
    );
    await client.query('COMMIT');
    return {
      userId: target.id,
      name: target.name,
      role: membership.rows[0]?.role ?? 'unknown',
      associationName: membership.rows[0]?.name ?? 'unknown',
      revokedSessions: revoked.rowCount ?? 0,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
