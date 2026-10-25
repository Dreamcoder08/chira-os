/*
 * Dates are formatted in code for the same reason percentages are: the headless
 * Chromium used by the tests ships a minimal ICU, and a locale-dependent format
 * would read differently on different phones. A technician comparing two visits
 * needs the same "05/11/2026" everywhere.
 */
export function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}
