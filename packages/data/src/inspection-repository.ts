import type { PoolClient } from 'pg';
import { DomainError, type Inspection } from '../../domain/src/guardian.ts';
import type {
  InspectionRepository,
  Principal,
} from '../../domain/src/ports.ts';

export class PostgresInspectionRepository implements InspectionRepository {
  constructor(
    private readonly client: PoolClient,
    private readonly principal: Principal,
  ) {}
  async find(id: string) {
    const result = await this.client.query<Inspection>(
      `SELECT id,parcel_id AS "parcelId",author_id AS "authorId",notes,biosecurity,photo_ids AS "photoIds",status,version,to_char(observed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "observedAt" FROM inspections WHERE id=$1 FOR UPDATE`,
      [id],
    );
    return result.rows[0];
  }
  async save(value: Inspection) {
    const result = await this.client.query(
      `INSERT INTO inspections(id,association_id,parcel_id,author_id,notes,biosecurity,photo_ids,status,version,observed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT(id) DO UPDATE SET notes=EXCLUDED.notes,biosecurity=EXCLUDED.biosecurity,photo_ids=EXCLUDED.photo_ids,status=EXCLUDED.status,version=EXCLUDED.version,updated_at=now()
      WHERE inspections.version=EXCLUDED.version-1 AND inspections.author_id=EXCLUDED.author_id AND inspections.parcel_id=EXCLUDED.parcel_id`,
      [
        value.id,
        this.principal.associationId,
        value.parcelId,
        value.authorId,
        value.notes,
        value.biosecurity,
        value.photoIds,
        value.status,
        value.version,
        value.observedAt,
      ],
    );
    if (!result.rowCount) throw new DomainError('VERSION_CONFLICT', 409);
  }
  async confirmedPhotos(inspectionId: string) {
    return (
      await this.client.query<{ id: string }>(
        'SELECT id FROM photos WHERE inspection_id=$1',
        [inspectionId],
      )
    ).rows.map((r) => r.id);
  }
  async recordReview(inspectionId: string, notes: string, followUp: boolean) {
    await this.client.query(
      'INSERT INTO reviews(id,association_id,inspection_id,reviewer_id,notes,follow_up) VALUES($1,$2,$3,$4,$5,$6)',
      [
        crypto.randomUUID(),
        this.principal.associationId,
        inspectionId,
        this.principal.userId,
        notes,
        followUp,
      ],
    );
    if (followUp)
      await this.client.query(
        'INSERT INTO notification_outbox(id,association_id,actor_id,inspection_id) VALUES($1,$2,$3,$4)',
        [
          crypto.randomUUID(),
          this.principal.associationId,
          this.principal.userId,
          inspectionId,
        ],
      );
  }
  async audit(action: string, entityId: string) {
    await this.client.query(
      'INSERT INTO audit_events(id,association_id,actor_id,action,entity_id) VALUES($1,$2,$3,$4,$5)',
      [
        crypto.randomUUID(),
        this.principal.associationId,
        this.principal.userId,
        action,
        entityId,
      ],
    );
  }
}
