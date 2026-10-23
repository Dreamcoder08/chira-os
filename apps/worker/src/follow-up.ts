import type { Pool } from 'pg';
import { withPrincipal } from '../../../packages/data/src/database.ts';
import { DomainError } from '../../../packages/domain/src/guardian.ts';

export type FollowUpJob = {
  associationId: string;
  userId: string;
  inspectionId: string;
  eventId: string;
};
export async function runFollowUp(pool: Pool, job: FollowUpJob) {
  await withPrincipal(pool, job, async (client, principal) => {
    if (principal.role !== 'coordinator')
      throw new DomainError('FORBIDDEN', 403);
    const event = await client.query<{ valid: boolean }>(
      'SELECT matching_follow_up($1,$2,$3,$4) AS valid',
      [job.eventId, job.associationId, job.userId, job.inspectionId],
    );
    if (!event.rows[0]?.valid) throw new DomainError('INVALID_JOB_EVENT', 403);
    const review = await client.query(
      'SELECT 1 FROM reviews WHERE inspection_id=$1 AND follow_up=true',
      [job.inspectionId],
    );
    if (!review.rowCount) throw new DomainError('NOT_FOUND', 404);
    // Persistent, observable readiness only; no email/Slack or third-party messages.
    await client.query(
      "INSERT INTO audit_events(id,association_id,actor_id,action,entity_id,event_key) VALUES($1,$2,$3,'follow_up.ready',$4,$5) ON CONFLICT(event_key) DO NOTHING",
      [
        crypto.randomUUID(),
        job.associationId,
        job.userId,
        job.inspectionId,
        job.eventId,
      ],
    );
  });
}
