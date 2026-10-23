import { PgBoss } from 'pg-boss';
import { makePool } from '../../../packages/data/src/database.ts';
import { runFollowUp, type FollowUpJob } from './follow-up.ts';

const pool = makePool(process.env.WORKER_DATABASE_URL);
const boss = new PgBoss({
  connectionString: process.env.WORKER_DATABASE_URL!,
  schema: 'jobs',
  migrate: false,
  createSchema: false,
});
boss.on('error', (error) =>
  console.error(
    JSON.stringify({ event: 'queue.error', message: error.message }),
  ),
);
await boss.start();
await boss.work<FollowUpJob>('guardian-follow-up', async (jobs) => {
  for (const job of jobs) await runFollowUp(pool, job.data);
});
async function dispatch() {
  const pending = await pool.query<{
    id: string;
    association_id: string;
    actor_id: string;
    inspection_id: string;
  }>('SELECT * FROM pending_follow_ups()');
  for (const event of pending.rows) {
    await boss.send(
      'guardian-follow-up',
      {
        eventId: event.id,
        associationId: event.association_id,
        userId: event.actor_id,
        inspectionId: event.inspection_id,
      },
      {
        singletonKey: event.id,
        singletonSeconds: 60,
        retryLimit: 5,
        retryDelay: 10,
        retryBackoff: true,
      },
    );
    await pool.query('SELECT mark_follow_up_dispatched($1)', [event.id]);
  }
}
let running = false;
const timer = setInterval(() => {
  if (running) return;
  running = true;
  dispatch()
    .catch(() =>
      console.error(JSON.stringify({ event: 'outbox.dispatch_failed' })),
    )
    .finally(() => {
      running = false;
    });
}, 5000);
console.log('Guardian worker ready; follow-ups stay inside CHIRA OS.');
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, async () => {
    clearInterval(timer);
    await boss.stop();
    await pool.end();
    process.exit(0);
  });
