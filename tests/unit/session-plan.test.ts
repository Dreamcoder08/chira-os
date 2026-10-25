import { describe, expect, it } from 'vitest';
import {
  buildSessionPlan,
  validateSessionInput,
} from '../../scripts/lib/session-plan.ts';

describe('session plan', () => {
  it('creates one coordinator and one technician per phone', () => {
    const plan = buildSessionPlan({ slug: 'oct29', technicians: 3 });
    expect(plan.accounts).toHaveLength(4);
    expect(plan.accounts[0]).toEqual({
      email: 'oct29-coordinador@chira.local',
      name: 'Coordinador',
      role: 'coordinator',
    });
    expect(
      plan.accounts.filter((account) => account.role === 'technician'),
    ).toHaveLength(3);
  });

  it('assigns one parcel per technician, each at its own spot', () => {
    const plan = buildSessionPlan({ slug: 'oct29', technicians: 3 });
    expect(plan.parcels).toHaveLength(3);
    expect(plan.parcels.map((parcel) => parcel.technician)).toEqual([1, 2, 3]);
    const spots = new Set(
      plan.parcels.map((parcel) => `${parcel.longitude},${parcel.latitude}`),
    );
    expect(spots.size).toBe(3);
  });

  it('keeps the parcels synthetic so no producer data is loaded', () => {
    const plan = buildSessionPlan({ slug: 'oct29', technicians: 1 });
    expect(plan.parcels[0]?.producerName).toBe('Productor sintético');
    expect(plan.parcels[0]?.name).toContain('Demostración');
  });

  it('rejects a slug that would produce unusable emails', () => {
    expect(
      validateSessionInput({ slug: 'Oct 29', technicians: 1 }),
    ).toHaveLength(1);
    expect(validateSessionInput({ slug: 'ab', technicians: 1 })).toHaveLength(
      1,
    );
  });

  it('rejects a session with no technicians or too many', () => {
    expect(
      validateSessionInput({ slug: 'oct29', technicians: 0 }),
    ).toHaveLength(1);
    expect(
      validateSessionInput({ slug: 'oct29', technicians: 9 }),
    ).toHaveLength(1);
    expect(
      validateSessionInput({ slug: 'oct29', technicians: 2.5 }),
    ).toHaveLength(1);
  });

  it('refuses to build a plan from invalid input', () => {
    expect(() => buildSessionPlan({ slug: 'x', technicians: 1 })).toThrow();
  });
});
