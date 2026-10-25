import type { Inspection } from '../../../../packages/contracts/src/schemas.ts';

/*
 * The history of a parcel is what turns one visit into a decision: a
 * coordinator comparing two counts can see whether the problem is growing.
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
 */
export type HistoryEntry = {
  id: string;
  observedAt: string;
  status: 'submitted' | 'reviewed';
  plantsObserved: number | null;
  plantsAffected: number | null;
  ratio: number | null;
};

const DEFAULT_LIMIT = 3;

function instant(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? -Infinity : parsed;
}

export function parcelHistory(
  inspections: Inspection[],
  parcelId: string,
  limit = DEFAULT_LIMIT,
): HistoryEntry[] {
  return inspections
    .filter(
      (inspection) =>
        inspection.parcelId === parcelId && inspection.status !== 'draft',
    )
    .map((inspection) => {
      const sampling = inspection.sampling ?? null;
      return {
        id: inspection.id,
        observedAt: inspection.observedAt,
        status: inspection.status as 'submitted' | 'reviewed',
        plantsObserved: sampling?.plantsObserved ?? null,
        plantsAffected: sampling?.plantsAffected ?? null,
        ratio:
          sampling && sampling.plantsObserved > 0
            ? sampling.plantsAffected / sampling.plantsObserved
            : null,
      };
    })
    .sort(
      (left, right) =>
        instant(right.observedAt) - instant(left.observedAt) ||
        left.id.localeCompare(right.id),
    )
    .slice(0, Math.max(limit, 0));
}
