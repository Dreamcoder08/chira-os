import { Pool, type PoolClient } from 'pg';
import { DomainError, type Role } from '../../domain/src/guardian.ts';
import type { Principal } from '../../domain/src/ports.ts';

export function makePool(url: string | undefined) {
  if (!url) throw new Error('Missing database connection configuration');
  return new Pool({
    connectionString: url,
    max: 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  });
}
export async function withPrincipal<T>(
  pool: Pool,
  principal: Pick<Principal, 'userId' | 'associationId'>,
  fn: (client: PoolClient, principal: Principal) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      "SELECT set_config('chira.user_id',$1,true),set_config('chira.association_id',$2,true),set_config('statement_timeout','10000',true)",
      [principal.userId, principal.associationId],
    );
    const membership = await client.query<{ role: Role }>(
      'SELECT role FROM memberships WHERE user_id=$1 AND association_id=$2',
      [principal.userId, principal.associationId],
    );
    const role = membership.rows[0]?.role;
    if (!role) throw new DomainError('FORBIDDEN', 403);
    const result = await fn(client, { ...principal, role });
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
