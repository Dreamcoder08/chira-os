import { describe, expect, it } from 'vitest';
import type {
  Inspection,
  Parcel,
} from '../../packages/contracts/src/schemas.ts';
import type { Draft } from '../../apps/web/src/lib/offline.ts';
import { pendingWork } from '../../apps/web/src/lib/workload.ts';

function parcel(id: string, name: string): Parcel {
  return {
    id,
    name,
    producerName: 'Productor sintético',
    crop: 'Banano orgánico',
    hectares: 2.4,
    location: { type: 'Point', coordinates: [-80.65, -4.84] },
    assignedTo: '00000000-0000-4000-8000-000000000001',
  };
}

function inspection(
  id: string,
  parcelId: string,
  status: Inspection['status'],
): Inspection {
  return {
    id,
    parcelId,
    authorId: '00000000-0000-4000-8000-000000000001',
    notes: 'Registro',
    biosecurity: true,
    photoIds: [],
    status,
    version: 1,
    observedAt: '2026-10-01T12:00:00.000Z',
    sampling: null,
  };
}

function draft(id: string, parcelId: string): Draft {
  return {
    id,
    associationId: '00000000-0000-4000-8000-0000000000aa',
    parcelId,
    authorId: '00000000-0000-4000-8000-000000000001',
    notes: 'Borrador',
    biosecurity: false,
    observedAt: '2026-10-02T12:00:00.000Z',
    photos: [],
    expectedVersion: 0,
    saveOperationId: 'op-save',
    submitOperationId: 'op-submit',
    state: 'pending',
  };
}

const parcels = [
  parcel('p1', 'Los Mangos'),
  parcel('p2', 'El Palmar'),
  parcel('p3', 'La Ribera'),
];

describe('pendingWork', () => {
  it('lists parcels without any submitted record', () => {
    const work = pendingWork(parcels, [], []);
    expect(work.map((item) => item.parcelName)).toEqual([
      'El Palmar',
      'La Ribera',
      'Los Mangos',
    ]);
    expect(work.every((item) => item.kind === 'unvisited')).toBe(true);
  });

  it('does not ask for a parcel already recorded', () => {
    const work = pendingWork(
      parcels,
      [],
      [inspection('i1', 'p1', 'submitted'), inspection('i2', 'p2', 'reviewed')],
    );
    expect(work).toEqual([
      { kind: 'unvisited', parcelId: 'p3', parcelName: 'La Ribera' },
    ]);
  });

  it('puts unsent drafts before parcels never visited', () => {
    const work = pendingWork(parcels, [draft('d1', 'p3')], []);
    expect(work[0]).toEqual({
      kind: 'draft',
      parcelId: 'p3',
      parcelName: 'La Ribera',
      draftId: 'd1',
    });
    expect(work.map((item) => item.kind)).toEqual([
      'draft',
      'unvisited',
      'unvisited',
    ]);
  });

  it('does not list a parcel twice when it has a draft and a record', () => {
    const work = pendingWork(
      parcels,
      [draft('d1', 'p1')],
      [inspection('i1', 'p1', 'submitted')],
    );
    expect(work.filter((item) => item.parcelId === 'p1')).toHaveLength(1);
    expect(work[0]?.kind).toBe('draft');
  });

  it('ignores a draft whose parcel is not in this workspace', () => {
    const work = pendingWork(parcels, [draft('d1', 'gone')], []);
    expect(work.some((item) => item.parcelId === 'gone')).toBe(false);
    expect(work).toHaveLength(3);
  });

  it('does not count a server draft as a recorded visit', () => {
    const work = pendingWork(parcels, [], [inspection('i1', 'p1', 'draft')]);
    expect(work.map((item) => item.parcelId)).toContain('p1');
  });

  it('returns nothing when every parcel has a submitted record', () => {
    const work = pendingWork(
      parcels,
      [],
      [
        inspection('i1', 'p1', 'submitted'),
        inspection('i2', 'p2', 'reviewed'),
        inspection('i3', 'p3', 'submitted'),
      ],
    );
    expect(work).toEqual([]);
  });
});
