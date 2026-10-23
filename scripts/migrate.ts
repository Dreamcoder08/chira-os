import { Pool } from 'pg';
import { readFile, readdir } from 'node:fs/promises';
import { PgBoss } from 'pg-boss';

const pool = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL });
const client = await pool.connect();
try {
  await client.query("SELECT pg_advisory_lock(hashtext('chira-migrations'))");
  for (const [role, variable] of [
    ['chira_app', 'APP_DB_PASSWORD'],
    ['chira_auth', 'AUTH_DB_PASSWORD'],
    ['chira_worker', 'WORKER_DB_PASSWORD'],
  ] as const) {
    const password = process.env[variable];
    if (!password || !/^[a-zA-Z0-9_-]{24,}$/.test(password))
      throw new Error(`Set a strong ${variable} (24+ URL-safe characters)`);
    if (
      !(await client.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [role]))
        .rowCount
    ) {
      // Role names are compile-time constants; passwords validated above, never logged.
      await client.query(
        `CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`,
      );
    }
  }
  await client.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  for (const file of (await readdir('packages/data/migrations'))
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    const version = file.split('_')[0]!;
    if (
      (
        await client.query('SELECT 1 FROM schema_migrations WHERE version=$1', [
          version,
        ])
      ).rowCount
    )
      continue;
    await client.query('BEGIN');
    await client.query(
      await readFile(`packages/data/migrations/${file}`, 'utf8'),
    );
    await client.query('INSERT INTO schema_migrations(version) VALUES ($1)', [
      version,
    ]);
    await client.query('COMMIT');
  }
  const boss = new PgBoss({
    connectionString: process.env.DATABASE_ADMIN_URL!,
    schema: 'jobs',
    supervise: false,
    schedule: false,
  });
  boss.on('error', (error) =>
    console.error('Queue initialization failed:', error.message),
  );
  await boss.start();
  await boss.createQueue('guardian-follow-up', {
    retryLimit: 5,
    retryDelay: 10,
    retryBackoff: true,
  });
  await boss.stop();
  await client.query(
    'GRANT USAGE ON SCHEMA jobs TO chira_worker; GRANT ALL ON ALL TABLES IN SCHEMA jobs TO chira_worker; GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA jobs TO chira_worker; GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA jobs TO chira_worker',
  );
  console.log('Migrations and restricted runtime roles ready.');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.query("SELECT pg_advisory_unlock(hashtext('chira-migrations'))");
  client.release();
  await pool.end();
}
