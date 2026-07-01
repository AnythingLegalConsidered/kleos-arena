// Pure two-tone thresholding core for the silhouette pipeline (CONCEPT §Art:
// black-figure style forced through a hard 2-tone quantization so every asset,
// whatever its source, lands on the exact same palette — the anti-AI-slop pass).
//
// This module only manipulates raw RGBA buffers: no image codec, no I/O, so it
// stays dependency-free and unit-testable. PNG encode/decode lives in cli.mjs.

/** @typedef {{ r: number, g: number, b: number, a: number }} Tone */

/**
 * Parse a CSS-like hex color ('#rgb' or '#rrggbb') or the keyword
 * 'transparent' into an RGBA tone.
 * @param {string} value
 * @returns {Tone}
 */
export function parseTone(value) {
  if (value === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  const hex = value.startsWith('#') ? value.slice(1) : value;
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(hex)) {
    throw new Error(`invalid tone '${value}' (expected #rgb, #rrggbb or 'transparent')`);
  }
  const full =
    hex.length === 3
      ? hex.split('').map((c) => c + c).join('')
      : hex;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
    a: 255,
  };
}

/**
 * Rec. 709 luma of one RGBA pixel, alpha-composited over the given backdrop
 * luma (0..255). Transparent source pixels therefore read as backdrop, which
 * maps them to the background side of the threshold.
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @param {number} a
 * @param {number} backdrop
 * @returns {number} 0..255
 */
export function luma(r, g, b, a, backdrop) {
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const alpha = a / 255;
  return y * alpha + backdrop * (1 - alpha);
}

/**
 * Build the 256-bin luma histogram of an RGBA buffer.
 * @param {Uint8Array | Uint8ClampedArray} rgba
 * @param {number} backdrop luma used under transparent pixels
 * @returns {Uint32Array} 256 bins
 */
export function lumaHistogram(rgba, backdrop) {
  const bins = new Uint32Array(256);
  for (let i = 0; i < rgba.length; i += 4) {
    const y = luma(rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3], backdrop);
    bins[Math.min(255, Math.max(0, Math.round(y)))]++;
  }
  return bins;
}

/**
 * Otsu's method: the threshold that maximizes between-class variance over a
 * 256-bin histogram. Deterministic: on ties the lowest threshold wins. Returns
 * 127 for degenerate (single-tone) histograms.
 * @param {Uint32Array} bins
 * @returns {number} threshold in 0..255; pixels with luma <= threshold are "dark"
 */
export function otsuThreshold(bins) {
  let total = 0;
  let weightedSum = 0;
  for (let t = 0; t < 256; t++) {
    total += bins[t];
    weightedSum += t * bins[t];
  }
  if (total === 0) return 127;

  let best = -1;
  let bestT = 127;
  let darkCount = 0;
  let darkSum = 0;
  for (let t = 0; t < 256; t++) {
    darkCount += bins[t];
    if (darkCount === 0) continue;
    const lightCount = total - darkCount;
    if (lightCount === 0) break;
    darkSum += t * bins[t];
    const darkMean = darkSum / darkCount;
    const lightMean = (weightedSum - darkSum) / lightCount;
    const between = darkCount * lightCount * (darkMean - lightMean) ** 2;
    if (between > best) {
      best = between;
      bestT = t;
    }
  }
  return bestT;
}

/**
 * Quantize an RGBA buffer to exactly two tones.
 *
 * By default the dark side of the threshold becomes the figure (black-figure
 * sources: dark subject on light ground). With `invert: true` the light side
 * is the figure (for white-on-black sources); transparent pixels then read as
 * a black backdrop instead of white, so they stay background either way.
 *
 * @param {Uint8Array | Uint8ClampedArray} rgba source pixels, length % 4 === 0
 * @param {{
 *   threshold?: number | 'otsu',
 *   invert?: boolean,
 *   fg?: Tone,
 *   bg?: Tone,
 * }} [options]
 * @returns {{ out: Uint8ClampedArray, threshold: number, figureRatio: number }}
 *   `out` contains only fg/bg tones; `figureRatio` is the fraction of pixels
 *   mapped to the figure (a sanity signal: near 0 or 1 means a bad source).
 */
export function toTwoTone(rgba, options = {}) {
  if (rgba.length % 4 !== 0) throw new Error('rgba length must be a multiple of 4');
  const invert = options.invert ?? false;
  const fg = options.fg ?? parseTone('#14110d');
  const bg = options.bg ?? parseTone('transparent');
  const backdrop = invert ? 0 : 255;

  const threshold =
    options.threshold === undefined || options.threshold === 'otsu'
      ? otsuThreshold(lumaHistogram(rgba, backdrop))
      : options.threshold;
  if (typeof threshold !== 'number' || threshold < 0 || threshold > 255) {
    throw new Error(`invalid threshold ${String(threshold)}`);
  }

  const out = new Uint8ClampedArray(rgba.length);
  let figurePixels = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    const y = luma(rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3], backdrop);
    const dark = y <= threshold;
    const isFigure = invert ? !dark : dark;
    const tone = isFigure ? fg : bg;
    if (isFigure) figurePixels++;
    out[i] = tone.r;
    out[i + 1] = tone.g;
    out[i + 2] = tone.b;
    out[i + 3] = tone.a;
  }
  const pixels = rgba.length / 4;
  return {
    out,
    threshold,
    figureRatio: pixels === 0 ? 0 : figurePixels / pixels,
  };
}
