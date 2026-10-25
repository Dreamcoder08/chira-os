import { describe, expect, it } from 'vitest';
import {
  editInspection,
  submitInspection,
  reviewInspection,
  incidence,
  safeCsvCell,
  type Inspection,
} from '../../packages/domain/src/guardian.ts';

const draft: Inspection = {
  id: 'inspection-1',
  parcelId: 'parcel-1',
  authorId: 'tech-1',
  notes: 'Hojas amarillas; requiere inspección humana',
  biosecurity: true,
  sampling: null,
  photoIds: [],
  status: 'draft',
  version: 1,
  observedAt: '2026-10-23T10:00:00.000Z',
};

describe('Guardian evidence lifecycle', () => {
  it('rejects an edit with a stale version instead of losing another device’s work', () => {
    expect(() =>
      editInspection(draft, { ...draft, notes: 'Otra visita' }, 'tech-1', 0),
    ).toThrow('VERSION_CONFLICT');
  });
  it('does not let another technician edit the author’s evidence', () => {
    expect(() => editInspection(draft, draft, 'tech-2', 1)).toThrow(
      'FORBIDDEN',
    );
  });
  it('requires confirmed photographs and a completed biosecurity checklist before submission', () => {
    expect(() =>
      submitInspection({ ...draft, photoIds: ['photo-1'] }, 1, []),
    ).toThrow('PHOTOS_PENDING');
    expect(() =>
      submitInspection({ ...draft, biosecurity: false }, 1, []),
    ).toThrow('BIOSECURITY_REQUIRED');
  });
  it('submits once and preserves submitted evidence against later edits', () => {
    const submitted = submitInspection(draft, 1, []);
    expect(submitted).toMatchObject({
      status: 'submitted',
      version: 2,
      notes: draft.notes,
    });
    expect(() => editInspection(submitted, draft, 'tech-1', 2)).toThrow(
      'IMMUTABLE_EVIDENCE',
    );
  });
  it('requires a coordinator and submitted evidence to record a human review', () => {
    expect(() => reviewInspection(draft, 'coordinator', 1)).toThrow(
      'NOT_SUBMITTED',
    );
    expect(() =>
      reviewInspection({ ...draft, status: 'submitted' }, 'technician', 1),
    ).toThrow('FORBIDDEN');
    expect(
      reviewInspection({ ...draft, status: 'submitted' }, 'coordinator', 1),
    ).toMatchObject({ status: 'reviewed', version: 2 });
  });
  it('rejects invalid observation dates and empty notes', () => {
    expect(() =>
      editInspection(undefined, { ...draft, notes: '  ' }, 'tech-1', 0),
    ).toThrow('INVALID_INSPECTION');
    expect(() =>
      editInspection(
        undefined,
        { ...draft, observedAt: 'yesterday' },
        'tech-1',
        0,
      ),
    ).toThrow('INVALID_INSPECTION');
  });
});

describe('spreadsheet export', () => {
  it.each(['=IMPORTXML("x")', '+1+1', '-1+1', '@SUM(A1)', '\t=cmd', '\r=cmd'])(
    'neutralizes formula %j',
    (value) => {
      expect(safeCsvCell(value)).toMatch(/^"'/);
    },
  );
  it('quotes commas, double quotes and newlines without interpreting HTML', () => {
    expect(safeCsvCell('A,"B"\n<script>')).toBe('"A,""B""\n<script>"');
  });
});

describe('Structured sampling', () => {
  const measured = (plantsObserved: number, plantsAffected: number) =>
    editInspection(
      draft,
      { ...draft, sampling: { plantsObserved, plantsAffected } },
      'tech-1',
      1,
    );

  it('records a count and derives incidence from it', () => {
    const saved = measured(40, 5);
    expect(saved.sampling).toEqual({ plantsObserved: 40, plantsAffected: 5 });
    expect(incidence(saved.sampling)).toBe(0.125);
  });
  it('accepts a visit with no symptomatic plants', () => {
    expect(incidence(measured(30, 0).sampling)).toBe(0);
  });
  it('refuses more symptomatic plants than evaluated ones', () => {
    expect(() => measured(10, 11)).toThrow('INVALID_SAMPLING');
  });
  it('refuses a sample of zero plants', () => {
    expect(() => measured(0, 0)).toThrow('INVALID_SAMPLING');
  });
  it('refuses fractional counts', () => {
    expect(() => measured(10.5, 2)).toThrow('INVALID_SAMPLING');
  });
  it('refuses a sample larger than any technician could walk', () => {
    expect(() => measured(501, 2)).toThrow('INVALID_SAMPLING');
  });
  it('keeps a visit without sampling valid and unmeasured', () => {
    const saved = editInspection(
      { ...draft, sampling: { plantsObserved: 10, plantsAffected: 1 } },
      { ...draft, sampling: null },
      'tech-1',
      1,
    );
    expect(saved.sampling).toBeNull();
    expect(incidence(saved.sampling)).toBeNull();
  });
  it('normalises an omitted count to unmeasured instead of undefined', () => {
    const withoutSampling = { ...draft } as Partial<Inspection>;
    delete withoutSampling.sampling;
    const saved = editInspection(
      draft,
      withoutSampling as Inspection,
      'tech-1',
      1,
    );
    expect(saved.sampling).toBeNull();
  });
});
