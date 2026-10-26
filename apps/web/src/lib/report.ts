import type { Inspection } from '../../../../packages/contracts/src/schemas.ts';
import { orderedVisits, type Visit } from './visits.ts';

/*
 * A printed report is read away from the phone: on a table, in a truck, at a
 * meeting. It has to say what the last visits measured and whether the problem
 * is growing, in a shape that fits on paper.
 *
 * Which visits count and in what order is decided in `visits.ts`, shared with
 * the parcel card, so a page and a screen never describe the same parcel
 * differently. This module adds only what paper needs: the notes, the real
 * total and the trend.
 */
export type ReportVisit = Visit & { notes: string };

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
  const notesById = new Map(
    inspections
      .filter((inspection) => inspection.parcelId === parcelId)
      .map((inspection) => [inspection.id, inspection.notes]),
  );
  // The list is capped for the page, but `totalVisits` keeps the real count so
  // the reader knows whether they are seeing everything.
  const ordered = orderedVisits(inspections, parcelId).map((visit) => ({
    ...visit,
    notes: notesById.get(visit.id) ?? '',
  }));

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
