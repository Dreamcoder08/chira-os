import type { Inspection } from '../../../../packages/contracts/src/schemas.ts';
import { orderedVisits, type Visit } from './visits.ts';

/*
 * The history of a parcel is what turns one visit into a decision: a
 * coordinator comparing two counts can see whether the problem is growing.
 * The rules that decide which visits count and in what order live in
 * `visits.ts`, shared with the printed report so both describe the parcel the
 * same way.
 */
export type HistoryEntry = Visit;

const DEFAULT_LIMIT = 3;

export function parcelHistory(
  inspections: Inspection[],
  parcelId: string,
  limit = DEFAULT_LIMIT,
): HistoryEntry[] {
  return orderedVisits(inspections, parcelId).slice(0, Math.max(limit, 0));
}
