import { describe, expect, it } from 'vitest';
import type { Inspection } from '../../packages/contracts/src/schemas.ts';
import { parcelHistory } from '../../apps/web/src/lib/history.ts';
import { formatShortDate } from '../../apps/web/src/lib/format.ts';

const PARCEL = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';

function inspection(overrides: Partial<Inspection> = {}): Inspection {
  return {
    id: '10000000-0000-4000-8000-000000000001',
    parcelId: PARCEL,
    authorId: 'workspace-user',
    notes: 'Visita',
    biosecurity: true,
    photoIds: [],
    status: 'submitted',
    version: 1,
    observedAt: '2026-01-01T12:00:00.000Z',
    sampling: null,
    ...overrides,
  };
}

describe('parcel history', () => {
  it('keeps only the parcel asked for', () => {
    const history = parcelHistory(
      [
        inspection(),
        inspection({
          id: '10000000-0000-4000-8000-000000000002',
          parcelId: OTHER,
        }),
      ],
      PARCEL,
    );
    expect(history).toHaveLength(1);
    expect(history[0]?.id).toBe('10000000-0000-4000-8000-000000000001');
  });

  it('leaves drafts out because they are not evidence yet', () => {
    const history = parcelHistory(
      [
        inspection(),
        inspection({
          id: '10000000-0000-4000-8000-000000000002',
          status: 'draft',
        }),
      ],
      PARCEL,
    );
    expect(history.map((entry) => entry.id)).toEqual([
      '10000000-0000-4000-8000-000000000001',
    ]);
  });

  it('orders newest first', () => {
    const history = parcelHistory(
      [
        inspection({ observedAt: '2026-01-01T12:00:00.000Z' }),
        inspection({
          id: '10000000-0000-4000-8000-000000000002',
          observedAt: '2026-03-01T12:00:00.000Z',
        }),
        inspection({
          id: '10000000-0000-4000-8000-000000000003',
          observedAt: '2026-02-01T12:00:00.000Z',
        }),
      ],
      PARCEL,
    );
    expect(history.map((entry) => entry.observedAt)).toEqual([
      '2026-03-01T12:00:00.000Z',
      '2026-02-01T12:00:00.000Z',
      '2026-01-01T12:00:00.000Z',
    ]);
  });

  it('keeps an unmeasured visit visible instead of hiding it', () => {
    const history = parcelHistory([inspection({ sampling: null })], PARCEL);
    expect(history[0]).toMatchObject({
      plantsObserved: null,
      plantsAffected: null,
      ratio: null,
    });
  });

  it('derives the ratio from the recorded counts', () => {
    const history = parcelHistory(
      [inspection({ sampling: { plantsObserved: 40, plantsAffected: 5 } })],
      PARCEL,
    );
    expect(history[0]?.ratio).toBeCloseTo(0.125);
    expect(history[0]?.plantsAffected).toBe(5);
  });

  it('reads a record without the sampling field as unmeasured', () => {
    const legacy = inspection();
    delete (legacy as { sampling?: unknown }).sampling;
    expect(parcelHistory([legacy], PARCEL)[0]?.ratio).toBeNull();
  });

  it('sorts an unparseable date last instead of breaking the order', () => {
    const history = parcelHistory(
      [
        inspection({ observedAt: 'no es una fecha' }),
        inspection({
          id: '10000000-0000-4000-8000-000000000002',
          observedAt: '2026-02-01T12:00:00.000Z',
        }),
      ],
      PARCEL,
    );
    expect(history.map((entry) => entry.id)).toEqual([
      '10000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000001',
    ]);
  });

  it('shows the three most recent visits by default', () => {
    const many = Array.from({ length: 5 }, (_, index) =>
      inspection({
        id: `10000000-0000-4000-8000-00000000000${index}`,
        observedAt: `2026-0${index + 1}-01T12:00:00.000Z`,
      }),
    );
    const history = parcelHistory(many, PARCEL);
    expect(history).toHaveLength(3);
    expect(history[0]?.observedAt).toBe('2026-05-01T12:00:00.000Z');
  });
});

describe('short date', () => {
  it('writes a fixed day/month/year instead of a locale format', () => {
    expect(formatShortDate('2026-11-05T12:00:00.000Z')).toMatch(
      /^\d{2}\/\d{2}\/2026$/,
    );
  });

  it('marks an unparseable date rather than printing Invalid Date', () => {
    expect(formatShortDate('no es una fecha')).toBe('—');
  });
});
