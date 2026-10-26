import { describe, expect, it } from 'vitest';
import { formatPercent } from '../../apps/web/src/lib/incidence.ts';

describe('Incidence text', () => {
  it('writes a tenth with a decimal comma, not a point', () => {
    expect(formatPercent(0.125)).toBe('12,5 %');
  });
  it('drops the empty decimal for whole percentages', () => {
    expect(formatPercent(0)).toBe('0 %');
    expect(formatPercent(1)).toBe('100 %');
    expect(formatPercent(0.3)).toBe('30 %');
  });
  it('rounds to one decimal instead of printing the raw ratio', () => {
    expect(formatPercent(1 / 3)).toBe('33,3 %');
    expect(formatPercent(0.0005)).toBe('0,1 %');
  });
});
