import type {
  Inspection,
  Parcel,
} from '../../../../packages/contracts/src/schemas.ts';
import type { Draft } from './offline.ts';

/*
 * What the technician still owes in this device, without asking them to
 * remember it.
 *
 * There is no date boundary on purpose. A phone can spend days offline, and a
 * list that empties itself at midnight would hide work that is still pending.
 * "Pending" here means exactly two things: a draft that never left the phone,
 * and a parcel that has no submitted record at all.
 */
export type WorkItem =
  | {
      kind: 'draft';
      parcelId: string;
      parcelName: string;
      draftId: string;
    }
  | { kind: 'unvisited'; parcelId: string; parcelName: string };

function byName(a: WorkItem, b: WorkItem): number {
  return a.parcelName.localeCompare(b.parcelName, 'es');
}

export function pendingWork(
  parcels: Parcel[],
  drafts: Draft[],
  inspections: Inspection[],
): WorkItem[] {
  const recorded = new Set(
    inspections
      .filter((item) => item.status !== 'draft')
      .map((item) => item.parcelId),
  );
  const drafted = new Set(drafts.map((draft) => draft.parcelId));
  const byId = new Map(parcels.map((parcel) => [parcel.id, parcel]));

  const work: WorkItem[] = [];
  for (const draft of drafts) {
    const parcel = byId.get(draft.parcelId);
    // A draft whose parcel vanished from this workspace cannot be completed,
    // so it is not offered as work; it stays visible in the inspections list.
    if (!parcel) continue;
    work.push({
      kind: 'draft',
      parcelId: parcel.id,
      parcelName: parcel.name,
      draftId: draft.id,
    });
  }
  for (const parcel of parcels) {
    if (recorded.has(parcel.id) || drafted.has(parcel.id)) continue;
    work.push({
      kind: 'unvisited',
      parcelId: parcel.id,
      parcelName: parcel.name,
    });
  }
  // Drafts first: continuing something already started is cheaper than opening
  // a parcel from scratch, and an unsent record is closer to being evidence.
  return work.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'draft' ? -1 : 1;
    return byName(a, b);
  });
}
