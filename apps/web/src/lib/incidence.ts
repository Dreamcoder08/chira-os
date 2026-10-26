/**
 * Percentage text for an incidence ratio.
 *
 * `Intl.NumberFormat('es-PE')` is not dependable here: a minimal-ICU build
 * formats 12.5% as "12.5%", and the same page would read differently on two
 * phones. A technician comparing a printed record with the screen needs the
 * same digits and the same decimal comma everywhere, so the format is fixed
 * rather than delegated to the runtime's locale data.
 */
export function formatPercent(ratio: number): string {
  const tenths = Math.round(ratio * 1000) / 10;
  const text = tenths.toFixed(1).replace(/\.0$/, '').replace('.', ',');
  return `${text} %`;
}
