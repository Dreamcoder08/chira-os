import type { Inspection } from '../../../../packages/contracts/src/schemas.ts';

/*
 * The rules that decide which visits count and in what order live here once.
 * They used to be copied into the parcel card and the printed report, which is
 * how the same parcel ended up described two different ways: the card kept a
 * visit that evaluated zero plants, the report called it unmeasured.
 *
 * Rules, all deliberate:
 * - Only the parcel asked for, keyed by id and never by name.
 * - Drafts stay out. A draft is work in progress on this device, not evidence
 *   someone sent, and mixing the two would let an unsent record change a
 *   coordinator's reading of the field.
 * - Newest first, and a record whose date cannot be parsed sorts last instead
 *   of corrupting the order.
 * - A visit without a count stays in the list and reads as unmeasured, because
 *   hiding it would make the parcel look unvisited.
 * - A count of zero evaluated plants is unmeasured, not a clean field: dividing
 *   nothing by nothing would print a reassuring percentage nobody measured.
 */
export type Visit = {
  id: string;
  observedAt: string;
  status: 'submitted' | 'reviewed';
  plantsObserved: number | null;
  plantsAffected: number | null;
  ratio: number | null;
};

type Counts = Pick<Visit, 'plantsObserved' | 'plantsAffected' | 'ratio'>;

const UNMEASURED: Counts = {
  plantsObserved: null,
  plantsAffected: null,
  ratio: null,
};

export function instant(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? -Infinity : parsed;
}

export function countsOf(sampling: Inspection['sampling']): Counts {
  const plantsObserved = sampling?.plantsObserved ?? 0;
  if (plantsObserved <= 0) return UNMEASURED;
  const plantsAffected = sampling?.plantsAffected ?? 0;
  return {
    plantsObserved,
    plantsAffected,
    ratio: plantsAffected / plantsObserved,
  };
}

/** Every recorded visit of one parcel, newest first, without a cap. */
export function orderedVisits(
  inspections: Inspection[],
  parcelId: string,
): Visit[] {
  return inspections
    .filter(
      (inspection) =>
        inspection.parcelId === parcelId && inspection.status !== 'draft',
    )
    .map((inspection) => ({
      id: inspection.id,
      observedAt: inspection.observedAt,
      status: inspection.status as 'submitted' | 'reviewed',
      ...countsOf(inspection.sampling),
    }))
    .sort(
      (left, right) =>
        instant(right.observedAt) - instant(left.observedAt) ||
        left.id.localeCompare(right.id),
    );
}
