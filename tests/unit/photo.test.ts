import { describe, expect, it } from 'vitest';
import {
  acceptsPhoto,
  fitWithin,
  MAX_INPUT_BYTES,
  MAX_PHOTO_EDGE,
} from '../../apps/web/src/lib/photo.ts';

describe('photo downscale', () => {
  it('shrinks a 48 MP phone photo so the long edge fits the limit', () => {
    expect(fitWithin(8064, 6048)).toEqual({ width: 2048, height: 1536 });
  });

  it('keeps the long edge for a portrait photo', () => {
    expect(fitWithin(6048, 8064)).toEqual({ width: 1536, height: 2048 });
  });

  it('never enlarges an image that already fits', () => {
    expect(fitWithin(30, 30)).toEqual({ width: 30, height: 30 });
    expect(fitWithin(2048, 1000)).toEqual({ width: 2048, height: 1000 });
  });

  it('rounds the short edge instead of truncating it', () => {
    // 4032x3024 at 2048 => 1536 exactly; 3000x2001 is not a clean ratio.
    expect(fitWithin(3000, 2001)).toEqual({ width: 2048, height: 1366 });
  });

  it('never produces a zero-pixel edge', () => {
    expect(fitWithin(10000, 1)).toEqual({ width: 2048, height: 1 });
  });

  it('exposes the same edge the server enforces', () => {
    expect(MAX_PHOTO_EDGE).toBe(2048);
  });
});

describe('photo input policy', () => {
  it('accepts a 15 MB phone photo, which the old 8 MB check rejected', () => {
    expect(acceptsPhoto({ size: 15 * 1024 * 1024, type: 'image/jpeg' })).toBe(
      true,
    );
  });

  it('accepts a file exactly at the decode guard', () => {
    expect(acceptsPhoto({ size: MAX_INPUT_BYTES, type: 'image/png' })).toBe(
      true,
    );
  });

  it('refuses a file past the decode guard', () => {
    expect(
      acceptsPhoto({ size: MAX_INPUT_BYTES + 1, type: 'image/jpeg' }),
    ).toBe(false);
  });

  it('refuses a format the server cannot decode', () => {
    expect(acceptsPhoto({ size: 1024, type: 'image/heic' })).toBe(false);
    expect(acceptsPhoto({ size: 1024, type: 'application/pdf' })).toBe(false);
  });
});
