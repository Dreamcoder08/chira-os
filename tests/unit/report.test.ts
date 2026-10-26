import { describe, expect, it } from 'vitest';
import type { Inspection } from '../../packages/contracts/src/schemas.ts';
import {
  TREND_THRESHOLD,
  parcelReport,
} from '../../apps/web/src/lib/report.ts';

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

describe('parcel report', () => {
  it('keeps only the parcel asked for', () => {
    const report = parcelReport(PARCEL, [
      inspection({ notes: 'La parcela pedida' }),
      inspection({
        id: '10000000-0000-4000-8000-000000000002',
        parcelId: OTHER,
        notes: 'Otra parcela',
      }),
    ]);
    expect(report.totalVisits).toBe(1);
    expect(report.visits).toHaveLength(1);
    expect(report.visits[0]?.notes).toBe('La parcela pedida');
  });

  it('leaves drafts out because an unsent draft is not evidence', () => {
    const report = parcelReport(PARCEL, [
      inspection(),
      inspection({
        id: '10000000-0000-4000-8000-000000000002',
        status: 'draft',
        observedAt: '2026-05-01T12:00:00.000Z',
      }),
    ]);
    expect(report.visits.map((visit) => visit.id)).toEqual([
      '10000000-0000-4000-8000-000000000001',
    ]);
    expect(report.lastVisit).toBe('2026-01-01T12:00:00.000Z');
  });

  it('orders newest first', () => {
    const report = parcelReport(PARCEL, [
      inspection({ observedAt: '2026-01-01T12:00:00.000Z' }),
      inspection({
        id: '10000000-0000-4000-8000-000000000002',
        observedAt: '2026-03-01T12:00:00.000Z',
      }),
      inspection({
        id: '10000000-0000-4000-8000-000000000003',
        observedAt: '2026-02-01T12:00:00.000Z',
      }),
    ]);
    expect(report.visits.map((visit) => visit.observedAt)).toEqual([
      '2026-03-01T12:00:00.000Z',
      '2026-02-01T12:00:00.000Z',
      '2026-01-01T12:00:00.000Z',
    ]);
  });

  it('sorts an unparseable date last instead of breaking the order', () => {
    const report = parcelReport(PARCEL, [
      inspection({ observedAt: 'no es una fecha' }),
      inspection({
        id: '10000000-0000-4000-8000-000000000002',
        observedAt: '2026-02-01T12:00:00.000Z',
      }),
    ]);
    expect(report.visits.map((visit) => visit.id)).toEqual([
      '10000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000001',
    ]);
  });

  it('applies the limit to the list but keeps the full visit count', () => {
    const many = Array.from({ length: 9 }, (_, index) =>
      inspection({
        id: `10000000-0000-4000-8000-00000000000${index}`,
        observedAt: `2026-0${index + 1}-01T12:00:00.000Z`,
      }),
    );
    const report = parcelReport(PARCEL, many, 4);
    expect(report.visits).toHaveLength(4);
    expect(report.totalVisits).toBe(9);
    expect(report.visits[0]?.observedAt).toBe('2026-09-01T12:00:00.000Z');
  });

  it('defaults to the six newest visits', () => {
    const many = Array.from({ length: 9 }, (_, index) =>
      inspection({
        id: `10000000-0000-4000-8000-00000000000${index}`,
        observedAt: `2026-0${index + 1}-01T12:00:00.000Z`,
      }),
    );
    const report = parcelReport(PARCEL, many);
    expect(report.visits).toHaveLength(6);
    expect(report.totalVisits).toBe(9);
  });

  it('reads a visit without sampling as unmeasured', () => {
    const report = parcelReport(PARCEL, [inspection({ sampling: null })]);
    expect(report.visits[0]).toMatchObject({
      plantsObserved: null,
      plantsAffected: null,
      ratio: null,
    });
  });

  it('reads a sample with zero observed plants as unmeasured', () => {
    const report = parcelReport(PARCEL, [
      inspection({ sampling: { plantsObserved: 0, plantsAffected: 0 } }),
    ]);
    expect(report.visits[0]).toMatchObject({
      plantsObserved: null,
      plantsAffected: null,
      ratio: null,
    });
  });

  it('derives the ratio from the recorded counts', () => {
    const report = parcelReport(PARCEL, [
      inspection({ sampling: { plantsObserved: 40, plantsAffected: 5 } }),
    ]);
    expect(report.visits[0]?.ratio).toBeCloseTo(0.125);
    expect(report.visits[0]?.plantsObserved).toBe(40);
  });

  it('reports nothing to compare for a parcel without visits', () => {
    const report = parcelReport(PARCEL, []);
    expect(report).toEqual({
      visits: [],
      totalVisits: 0,
      latest: null,
      previous: null,
      trend: 'unknown',
      lastVisit: null,
    });
  });

  it('exposes the trend threshold as a readability rule', () => {
    expect(TREND_THRESHOLD).toBe(0.01);
  });

  it('reads the trend as up when the ratio grew beyond the threshold', () => {
    const report = parcelReport(PARCEL, [
      inspection({
        id: '10000000-0000-4000-8000-000000000001',
        observedAt: '2026-01-01T12:00:00.000Z',
        sampling: { plantsObserved: 100, plantsAffected: 10 },
      }),
      inspection({
        id: '10000000-0000-4000-8000-000000000002',
        observedAt: '2026-02-01T12:00:00.000Z',
        sampling: { plantsObserved: 100, plantsAffected: 12 },
      }),
    ]);
    expect(report.trend).toBe('up');
  });

  it('reads the trend as down when the ratio fell beyond the threshold', () => {
    const report = parcelReport(PARCEL, [
      inspection({
        id: '10000000-0000-4000-8000-000000000001',
        observedAt: '2026-01-01T12:00:00.000Z',
        sampling: { plantsObserved: 100, plantsAffected: 10 },
      }),
      inspection({
        id: '10000000-0000-4000-8000-000000000002',
        observedAt: '2026-02-01T12:00:00.000Z',
        sampling: { plantsObserved: 100, plantsAffected: 8 },
      }),
    ]);
    expect(report.trend).toBe('down');
  });

  it('reads a change inside the threshold as stable', () => {
    const report = parcelReport(PARCEL, [
      inspection({
        id: '10000000-0000-4000-8000-000000000001',
        observedAt: '2026-01-01T12:00:00.000Z',
        sampling: { plantsObserved: 100, plantsAffected: 10 },
      }),
      inspection({
        id: '10000000-0000-4000-8000-000000000002',
        observedAt: '2026-02-01T12:00:00.000Z',
        sampling: { plantsObserved: 200, plantsAffected: 21 },
      }),
    ]);
    expect(report.trend).toBe('stable');
  });

  it('reads the trend as unknown when either compared ratio is missing', () => {
    const missingLatest = parcelReport(PARCEL, [
      inspection({
        id: '10000000-0000-4000-8000-000000000001',
        observedAt: '2026-01-01T12:00:00.000Z',
        sampling: { plantsObserved: 100, plantsAffected: 10 },
      }),
      inspection({
        id: '10000000-0000-4000-8000-000000000002',
        observedAt: '2026-02-01T12:00:00.000Z',
        sampling: null,
      }),
    ]);
    expect(missingLatest.trend).toBe('unknown');

    const missingPrevious = parcelReport(PARCEL, [
      inspection({
        id: '10000000-0000-4000-8000-000000000001',
        observedAt: '2026-01-01T12:00:00.000Z',
        sampling: null,
      }),
      inspection({
        id: '10000000-0000-4000-8000-000000000002',
        observedAt: '2026-02-01T12:00:00.000Z',
        sampling: { plantsObserved: 100, plantsAffected: 10 },
      }),
    ]);
    expect(missingPrevious.trend).toBe('unknown');

    const singleVisit = parcelReport(PARCEL, [
      inspection({ sampling: { plantsObserved: 100, plantsAffected: 10 } }),
    ]);
    expect(singleVisit.trend).toBe('unknown');
  });

  it('points latest and previous at the two newest visits', () => {
    const report = parcelReport(PARCEL, [
      inspection({
        id: '10000000-0000-4000-8000-000000000001',
        observedAt: '2026-01-01T12:00:00.000Z',
      }),
      inspection({
        id: '10000000-0000-4000-8000-000000000002',
        observedAt: '2026-02-01T12:00:00.000Z',
      }),
      inspection({
        id: '10000000-0000-4000-8000-000000000003',
        observedAt: '2026-03-01T12:00:00.000Z',
      }),
    ]);
    expect(report.latest?.id).toBe('10000000-0000-4000-8000-000000000003');
    expect(report.previous?.id).toBe('10000000-0000-4000-8000-000000000002');
    expect(report.lastVisit).toBe('2026-03-01T12:00:00.000Z');
  });
});
