import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { Principal } from '../../domain/src/ports.ts';
import { DomainError } from '../../domain/src/guardian.ts';

export async function idempotent<T>(
  client: PoolClient,
  principal: Principal,
  operationId: string,
  identity: unknown,
  action: () => Promise<T>,
): Promise<T> {
  const fingerprint = createHash('sha256')
    .update(JSON.stringify(identity))
    .digest('hex');
  // Transaction lock serializes a key, including concurrent initial inserts.
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
    `${principal.associationId}:${principal.userId}:${operationId}`,
  ]);
  const previous = (
    await client.query<{ fingerprint: string; response: T }>(
      'SELECT fingerprint,response FROM sync_operations WHERE association_id=$1 AND actor_id=$2 AND operation_id=$3',
      [principal.associationId, principal.userId, operationId],
    )
  ).rows[0];
  if (previous) {
    if (previous.fingerprint !== fingerprint)
      throw new DomainError('OPERATION_KEY_REUSED', 409);
    return previous.response;
  }
  const result = await action();
  await client.query(
    'INSERT INTO sync_operations(association_id,actor_id,operation_id,fingerprint,response) VALUES($1,$2,$3,$4,$5)',
    [
      principal.associationId,
      principal.userId,
      operationId,
      fingerprint,
      JSON.stringify(result),
    ],
  );
  return result;
}
