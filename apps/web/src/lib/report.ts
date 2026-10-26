import type { Inspection } from '../../../../packages/contracts/src/schemas.ts';

/*
 * A printed report is read away from the phone: on a table, in a truck, at a
 * meeting. It has to say what the last visits measured and whether the problem
 * is growing, in a shape that fits on paper.
 *
 * Rules, all deliberate:
 * - Only the parcel asked for, keyed by id and never by name.
 * - Drafts stay out. A draft is work in progress on this device, not evidence
 *   someone sent, and a printed page must not credit a parcel with a visit that
 *   was never submitted.
 * - Newest first, and a record whose date cannot be parsed sorts last instead
 *   of corrupting the order.
 * - The list is capped for the page, but `totalVisits` keeps the real count so
 *   the reader knows whether they are seeing everything.
 */
export type ReportVisit = {
  id: string;
  observedAt: string;
  status: 'submitted' | 'reviewed';
  plantsObserved: number | null;
  plantsAffected: number | null;
  ratio: number | null;
  notes: string;
};

export type ReportTrend = 'up' | 'down' | 'stable' | 'unknown';

export type ParcelReport = {
  visits: ReportVisit[];
  totalVisits: number;
  latest: ReportVisit | null;
  previous: ReportVisit | null;
  trend: ReportTrend;
  lastVisit: string | null;
};

/*
 * Two ratios closer than one hundredth read as the same number on the printed
 * page. This is a readability rule for paper, not an agronomic criterion: it
 * never claims a field is healthy or at risk, only that the printed comparison
 * would not show a difference.
 */
export const TREND_THRESHOLD = 0.01;

const DEFAULT_LIMIT = 6;

function instant(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? -Infinity : parsed;
}

type Counts = Pick<ReportVisit, 'plantsObserved' | 'plantsAffected' | 'ratio'>;

const UNMEASURED: Counts = {
  plantsObserved: null,
  plantsAffected: null,
  ratio: null,
};

function countsOf(sampling: Inspection['sampling']): Counts {
  const plantsObserved = sampling?.plantsObserved ?? 0;
  // A sample that observed no plants measured nothing, so it reads as
  // unmeasured instead of as a zero ratio that would look like a clean field.
  if (plantsObserved <= 0) return UNMEASURED;
  const plantsAffected = sampling?.plantsAffected ?? 0;
  return {
    plantsObserved,
    plantsAffected,
    ratio: plantsAffected / plantsObserved,
  };
}

function toVisit(inspection: Inspection): ReportVisit {
  return {
    id: inspection.id,
    observedAt: inspection.observedAt,
    status: inspection.status as 'submitted' | 'reviewed',
    ...countsOf(inspection.sampling),
    notes: inspection.notes,
  };
}

function trendOf(
  latest: ReportVisit | null,
  previous: ReportVisit | null,
): ReportTrend {
  const current = latest?.ratio ?? null;
  const prior = previous?.ratio ?? null;
  if (current === null || prior === null) return 'unknown';
  const delta = current - prior;
  if (delta >= TREND_THRESHOLD) return 'up';
  if (delta <= -TREND_THRESHOLD) return 'down';
  return 'stable';
}

export function parcelReport(
  parcelId: string,
  inspections: Inspection[],
  limit = DEFAULT_LIMIT,
): ParcelReport {
  const ordered = inspections
    .filter(
      (inspection) =>
        inspection.parcelId === parcelId && inspection.status !== 'draft',
    )
    .map(toVisit)
    .sort(
      (left, right) =>
        instant(right.observedAt) - instant(left.observedAt) ||
        left.id.localeCompare(right.id),
    );

  const visits = ordered.slice(0, Math.max(limit, 0));
  const latest = visits[0] ?? null;
  const previous = visits[1] ?? null;

  return {
    visits,
    totalVisits: ordered.length,
    latest,
    previous,
    trend: trendOf(latest, previous),
    lastVisit: latest?.observedAt ?? null,
  };
}
