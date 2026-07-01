import { describe, expect, it } from 'vitest';
// Plain .mjs tooling module (typed via JSDoc, no .d.ts). Fine at runtime:
// vitest transpiles without type-checking and test/ sits outside tsc --build.
// @ts-ignore
import {
  luma,
  lumaHistogram,
  otsuThreshold,
  parseTone,
  toTwoTone,
} from '../../scripts/silhouette/threshold.mjs';

/** Build an RGBA buffer from [r,g,b,a] pixel tuples. */
function rgba(pixels: number[][]): Uint8ClampedArray {
  const out = new Uint8ClampedArray(pixels.length * 4);
  pixels.forEach((p, i) => out.set(p, i * 4));
  return out;
}

const BLACK = [0, 0, 0, 255];
const WHITE = [255, 255, 255, 255];
const CLEAR = [0, 0, 0, 0];

describe('parseTone', () => {
  it('parses 6-digit and 3-digit hex and transparent', () => {
    expect(parseTone('#14110d')).toEqual({ r: 0x14, g: 0x11, b: 0x0d, a: 255 });
    expect(parseTone('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 255 });
    expect(parseTone('transparent')).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  it('rejects malformed values', () => {
    expect(() => parseTone('#12345')).toThrow(/invalid tone/);
    expect(() => parseTone('red')).toThrow(/invalid tone/);
  });
});

describe('luma', () => {
  it('maps black to 0 and white to 255', () => {
    expect(luma(0, 0, 0, 255, 255)).toBe(0);
    expect(luma(255, 255, 255, 255, 0)).toBeCloseTo(255, 5);
  });

  it('reads fully transparent pixels as the backdrop', () => {
    expect(luma(10, 20, 30, 0, 255)).toBe(255);
    expect(luma(200, 200, 200, 0, 0)).toBe(0);
  });
});

describe('lumaHistogram', () => {
  it('bins pixels by composited luma', () => {
    const bins = lumaHistogram(rgba([BLACK, WHITE, CLEAR]), 255);
    expect(bins[0]).toBe(1);
    expect(bins[255]).toBe(2); // white + transparent-over-white backdrop
  });
});

describe('otsuThreshold', () => {
  it('separates a bimodal histogram between its two modes', () => {
    const bins = new Uint32Array(256);
    bins[30] = 100; // dark mode
    bins[220] = 100; // light mode
    const t = otsuThreshold(bins);
    expect(t).toBeGreaterThanOrEqual(30);
    expect(t).toBeLessThan(220);
  });

  it('is deterministic and falls back to 127 on degenerate input', () => {
    expect(otsuThreshold(new Uint32Array(256))).toBe(127);
    const flat = new Uint32Array(256);
    flat[128] = 50;
    expect(otsuThreshold(flat)).toBe(127);
  });
});

describe('toTwoTone', () => {
  const fg = parseTone('#14110d');
  const bg = parseTone('transparent');

  it('maps dark pixels to fg and light pixels to bg by default', () => {
    const { out, figureRatio } = toTwoTone(rgba([BLACK, WHITE, BLACK, WHITE]));
    expect([...out.slice(0, 4)]).toEqual([fg.r, fg.g, fg.b, 255]);
    expect([...out.slice(4, 8)]).toEqual([bg.r, bg.g, bg.b, 0]);
    expect(figureRatio).toBe(0.5);
  });

  it('emits exactly the two requested tones, nothing else', () => {
    // Noisy gradient input: the whole point of the pass is that the output
    // palette collapses to fg/bg only (CONCEPT: le seuillage uniformise).
    const pixels: number[][] = [];
    for (let value = 0; value < 256; value += 5) {
      pixels.push([value, value, value, 255]);
    }
    const custom = { fg: parseTone('#e8dcc0'), bg: parseTone('#100d09') };
    const { out } = toTwoTone(rgba(pixels), custom);
    for (let index = 0; index < out.length; index += 4) {
      const pixel = [out[index], out[index + 1], out[index + 2], out[index + 3]];
      const isFg =
        pixel[0] === custom.fg.r && pixel[1] === custom.fg.g && pixel[2] === custom.fg.b;
      const isBg =
        pixel[0] === custom.bg.r && pixel[1] === custom.bg.g && pixel[2] === custom.bg.b;
      expect(isFg || isBg).toBe(true);
      expect(pixel[3]).toBe(255);
    }
  });

  it('treats transparent input pixels as background', () => {
    const { out, figureRatio } = toTwoTone(rgba([CLEAR, BLACK]));
    expect(out[3]).toBe(0); // transparent source -> bg (alpha 0)
    expect(figureRatio).toBe(0.5);
  });

  it('inverts figure/background for light-on-dark sources', () => {
    const { out } = toTwoTone(rgba([BLACK, WHITE, CLEAR]), { invert: true });
    // black is now background, white is the figure
    expect(out[3]).toBe(0);
    expect([...out.slice(4, 8)]).toEqual([fg.r, fg.g, fg.b, 255]);
    // transparent composites over a black backdrop -> still background
    expect(out[11]).toBe(0);
  });

  it('honors an explicit numeric threshold', () => {
    const gray = [100, 100, 100, 255];
    expect(toTwoTone(rgba([gray]), { threshold: 99 }).figureRatio).toBe(0);
    expect(toTwoTone(rgba([gray]), { threshold: 100 }).figureRatio).toBe(1);
  });

  it('is deterministic for identical inputs', () => {
    const pixels = rgba([BLACK, WHITE, [90, 120, 40, 200], CLEAR]);
    const a = toTwoTone(pixels);
    const b = toTwoTone(pixels);
    expect(a.threshold).toBe(b.threshold);
    expect([...a.out]).toEqual([...b.out]);
  });

  it('rejects buffers that are not RGBA-aligned', () => {
    expect(() => toTwoTone(new Uint8ClampedArray(5))).toThrow(/multiple of 4/);
  });
});
