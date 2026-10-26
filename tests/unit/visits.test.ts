import { describe, expect, it } from 'vitest';
import type { Inspection } from '../../packages/contracts/src/schemas.ts';
import { countsOf, orderedVisits } from '../../apps/web/src/lib/visits.ts';

function inspection(overrides: Partial<Inspection> = {}): Inspection {
  return {
    id: 'i1',
    parcelId: 'p1',
    authorId: 'u1',
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

describe('visits', () => {
  it('keeps only the parcel asked for and drops drafts', () => {
    const work = orderedVisits(
      [
        inspection({ id: 'a' }),
        inspection({ id: 'b', parcelId: 'p2' }),
        inspection({ id: 'c', status: 'draft' }),
      ],
      'p1',
    );
    expect(work.map((visit) => visit.id)).toEqual(['a']);
  });

  it('orders newest first and sends an unparseable date last', () => {
    const work = orderedVisits(
      [
        inspection({ id: 'old', observedAt: '2026-01-01T12:00:00.000Z' }),
        inspection({ id: 'broken', observedAt: 'no es una fecha' }),
        inspection({ id: 'new', observedAt: '2026-03-01T12:00:00.000Z' }),
      ],
      'p1',
    );
    expect(work.map((visit) => visit.id)).toEqual(['new', 'old', 'broken']);
  });

  it('derives the ratio from the counts', () => {
    const work = orderedVisits(
      [inspection({ sampling: { plantsObserved: 40, plantsAffected: 5 } })],
      'p1',
    );
    expect(work[0]?.plantsObserved).toBe(40);
    expect(work[0]?.plantsAffected).toBe(5);
    expect(work[0]?.ratio).toBeCloseTo(0.125);
  });

  /*
   * A sample that evaluated zero plants measured nothing. Printing "0 %" there
   * would read as a clean field, which is the one claim this product must never
   * make by accident.
   */
  it('reads a zero evaluated count as unmeasured', () => {
    expect(countsOf({ plantsObserved: 0, plantsAffected: 0 })).toEqual({
      plantsObserved: null,
      plantsAffected: null,
      ratio: null,
    });
    expect(countsOf(null)).toEqual({
      plantsObserved: null,
      plantsAffected: null,
      ratio: null,
    });
  });
});
