import { LUMA } from "./color";
import { srgbToLinear } from "./pipeline";

// Measures the "look" of an image: tone (lightness spread), color cast,
// saturation, and the tint of its shadows, midtones and highlights.
// Color is measured in OKLab, where distances track what the eye sees:
// L is lightness 0–1, a is green(-)/magenta(+), b is blue(-)/yellow(+).

export const PERCENTILES = [0.01, 0.05, 0.25, 0.5, 0.75, 0.95, 0.99];
export const MEDIAN = 3;

export interface Tint {
  a: number;
  b: number;
}

export interface ImageStats {
  /** OKLab lightness at each of PERCENTILES. */
  lightness: number[];
  /** Display luma (what the Luma curve acts on) at each of PERCENTILES. */
  luma: number[];
  /** Mean color cast. */
  a: number;
  b: number;
  /** Mean colorfulness. */
  chroma: number;
  /** Mean tint per tonal zone, weighted the same way as the Color Balance tool. */
  zones: { shadows: Tint; midtones: Tint; highlights: Tint };
  /** True when color depends only on brightness, as in plain or toned black & white. */
  mono: boolean;
}

const BINS = 1024;
/** Brightness bands used to tell toned black & white from color. */
const MONO_BANDS = 32;
/** Mean color left once each band's own tint is removed; below this the image has no real color. */
const MONO_THRESHOLD = 0.012;

/** Analyzes RGB triplets in display (sRGB) space, 0–1. */
export function analyze(pixels: Float32Array): ImageStats {
  const n = pixels.length / 3;
  const lightHist = new Uint32Array(BINS);
  const lumaHist = new Uint32Array(BINS);
  const labA = new Float32Array(n);
  const labB = new Float32Array(n);
  const band = new Uint8Array(n);
  const bands = Array.from({ length: MONO_BANDS }, () => ({ n: 0, a: 0, b: 0 }));
  let sumA = 0;
  let sumB = 0;
  let sumChroma = 0;
  const zoneSums = [0, 0, 0].map(() => ({ w: 0, a: 0, b: 0 }));

  for (let i = 0; i < n; i++) {
    const r = pixels[i * 3];
    const g = pixels[i * 3 + 1];
    const bl = pixels[i * 3 + 2];
    const [L, a, b] = oklab(srgbToLinear(r), srgbToLinear(g), srgbToLinear(bl));
    const y = LUMA[0] * r + LUMA[1] * g + LUMA[2] * bl;
    lightHist[bin(L)]++;
    lumaHist[bin(y)]++;
    labA[i] = a;
    labB[i] = b;
    sumA += a;
    sumB += b;
    sumChroma += Math.hypot(a, b);
    band[i] = Math.min(MONO_BANDS - 1, Math.floor(y * MONO_BANDS));
    bands[band[i]].n++;
    bands[band[i]].a += a;
    bands[band[i]].b += b;
    const w = [(1 - y) * (1 - y), 2 * y * (1 - y), y * y];
    for (let z = 0; z < 3; z++) {
      zoneSums[z].w += w[z];
      zoneSums[z].a += w[z] * a;
      zoneSums[z].b += w[z] * b;
    }
  }

  const zones = zoneSums.map((z) => ({ a: z.a / Math.max(z.w, 1e-9), b: z.b / Math.max(z.w, 1e-9) }));

  // How much color is left once each brightness band's own mean tint is removed.
  let residual = 0;
  for (let i = 0; i < n; i++) {
    const bd = bands[band[i]];
    residual += Math.hypot(labA[i] - bd.a / bd.n, labB[i] - bd.b / bd.n);
  }

  return {
    lightness: percentiles(lightHist, n),
    luma: percentiles(lumaHist, n),
    a: sumA / n,
    b: sumB / n,
    chroma: sumChroma / n,
    zones: { shadows: zones[0], midtones: zones[1], highlights: zones[2] },
    mono: residual / n < MONO_THRESHOLD,
  };
}

/** Linear sRGB to OKLab (Björn Ottosson, 2020). */
export function oklab(r: number, g: number, b: number): [number, number, number] {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function bin(v: number): number {
  return Math.min(BINS - 1, Math.max(0, Math.floor(v * BINS)));
}

function percentiles(hist: Uint32Array, n: number): number[] {
  return PERCENTILES.map((p) => {
    const target = p * n;
    let acc = 0;
    for (let i = 0; i < BINS; i++) {
      acc += hist[i];
      if (acc >= target) return (i + 0.5) / BINS;
    }
    return 1;
  });
}
