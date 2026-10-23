import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { hashPassword } from 'better-auth/crypto';
import { Pool } from 'pg';

if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1', 'db'].includes(
    new URL(process.env.DATABASE_ADMIN_URL!).hostname,
  )
)
  throw new Error(
    'Synthetic seed only permitted on local development databases',
  );
await mkdir('.local', { recursive: true, mode: 0o700 });
const fixturePath = '.local/demo-credentials.json';
let fixture: {
  associationId: string;
  otherAssociationId: string;
  parcelId: string;
  otherParcelId: string;
  techId: string;
  otherTechId: string;
  coordinatorId: string;
  password: string;
};
try {
  fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
} catch {
  fixture = {
    associationId: randomUUID(),
    otherAssociationId: randomUUID(),
    parcelId: randomUUID(),
    otherParcelId: randomUUID(),
    techId: randomUUID(),
    otherTechId: randomUUID(),
    coordinatorId: randomUUID(),
    password: randomBytes(20).toString('base64url'),
  };
}
const pool = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  for (const [id, email, name, association, role] of [
    [
      fixture.techId,
      'tecnico@chira.test',
      'Técnico de demostración',
      fixture.associationId,
      'technician',
    ],
    [
      fixture.coordinatorId,
      'coordinador@chira.test',
      'Coordinadora de demostración',
      fixture.associationId,
      'coordinator',
    ],
    [
      fixture.otherTechId,
      'otro@chira.test',
      'Otra asociación',
      fixture.otherAssociationId,
      'technician',
    ],
  ] as const) {
    await client.query(
      'INSERT INTO auth_users(id,name,email,email_verified) VALUES($1,$2,$3,true) ON CONFLICT(id) DO NOTHING',
      [id, name, email],
    );
    await client.query(
      "INSERT INTO auth_accounts(id,account_id,provider_id,user_id,password) VALUES($1,$2,'credential',$2,$3) ON CONFLICT(provider_id,account_id) DO NOTHING",
      [randomUUID(), id, await hashPassword(fixture.password)],
    );
    await client.query(
      'INSERT INTO associations(id,name) VALUES($1,$2) ON CONFLICT DO NOTHING',
      [
        association,
        association === fixture.associationId
          ? 'Asociación Chira · Demo'
          : 'Otra asociación · Demo',
      ],
    );
    await client.query(
      'INSERT INTO memberships(association_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
      [association, id, role],
    );
  }
  for (const [id, tenant, assigned, name] of [
    [
      fixture.parcelId,
      fixture.associationId,
      fixture.techId,
      'La Ribera · Demo',
    ],
    [
      fixture.otherParcelId,
      fixture.otherAssociationId,
      fixture.otherTechId,
      'Parcela privada · Demo',
    ],
  ]) {
    await client.query(
      "INSERT INTO parcels(id,association_id,name,producer_name,crop,hectares,location,assigned_to) VALUES($1,$2,$3,'Productor sintético','Banano orgánico',2.4,ST_SetSRID(ST_MakePoint(-80.65,-4.84),4326),$4) ON CONFLICT DO NOTHING",
      [id, tenant, name, assigned],
    );
  }
  await client.query('COMMIT');
  await writeFile(fixturePath, JSON.stringify(fixture, null, 2) + '\n', {
    mode: 0o600,
  });
  console.log(
    'Synthetic associations ready. Local credentials: .local/demo-credentials.json (never commit).',
  );
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
