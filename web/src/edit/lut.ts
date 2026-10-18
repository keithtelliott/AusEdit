import type { CurveChannel, CurvePoint, Levels, LevelsChannel } from "./settings";

// Levels and curves are folded into one lookup table (LUT) the shader reads:
// R, G, B hold each channel's combined mapping, A holds the luma curve.
// Per channel the order is: channel levels, RGB levels, RGB curve, channel curve.

export const LUT_SIZE = 1024;

export function applyLevels(x: number, lv: Levels): number {
  const lo = lv.inBlack / 255;
  const hi = lv.inWhite / 255;
  const t = Math.pow(clamp01((x - lo) / Math.max(hi - lo, 1e-4)), 1 / lv.gamma);
  return lv.outBlack / 255 + t * ((lv.outWhite - lv.outBlack) / 255);
}

/**
 * Monotone cubic interpolation (Fritsch–Carlson) through the points, so the
 * curve never overshoots between them. Flat beyond the first and last point.
 */
export function makeCurve(points: CurvePoint[]): (x: number) => number {
  const pts = [...points].sort((a, b) => a.x - b.x);
  const n = pts.length;
  if (n === 0) return (x) => x;
  if (n === 1) return () => clamp01(pts[0].y);

  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(Math.max(pts[i + 1].x - pts[i].x, 1e-6));
    slope.push((pts[i + 1].y - pts[i].y) / dx[i]);
  }

  const tangent: number[] = [slope[0]];
  for (let i = 1; i < n - 1; i++) {
    tangent.push(slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2);
  }
  tangent.push(slope[n - 2]);

  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      tangent[i] = 0;
      tangent[i + 1] = 0;
      continue;
    }
    const a = tangent[i] / slope[i];
    const b = tangent[i + 1] / slope[i];
    const h = Math.hypot(a, b);
    if (h > 3) {
      tangent[i] = (3 / h) * a * slope[i];
      tangent[i + 1] = (3 / h) * b * slope[i];
    }
  }

  return (x) => {
    if (x <= pts[0].x) return clamp01(pts[0].y);
    if (x >= pts[n - 1].x) return clamp01(pts[n - 1].y);
    let i = 0;
    while (x > pts[i + 1].x) i++;
    const h = dx[i];
    const t = (x - pts[i].x) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    const y =
      (2 * t3 - 3 * t2 + 1) * pts[i].y +
      (t3 - 2 * t2 + t) * h * tangent[i] +
      (-2 * t3 + 3 * t2) * pts[i + 1].y +
      (t3 - t2) * h * tangent[i + 1];
    return clamp01(y);
  };
}

export function buildLut(levels: Record<LevelsChannel, Levels>, curves: Record<CurveChannel, CurvePoint[]>): Float32Array {
  const rgbCurve = makeCurve(curves.rgb);
  const lumaCurve = makeCurve(curves.luma);
  const channels = (["r", "g", "b"] as const).map((ch) => ({ levels: levels[ch], curve: makeCurve(curves[ch]) }));

  const lut = new Float32Array(LUT_SIZE * 4);
  for (let i = 0; i < LUT_SIZE; i++) {
    const x = i / (LUT_SIZE - 1);
    channels.forEach((ch, c) => {
      lut[i * 4 + c] = ch.curve(rgbCurve(applyLevels(applyLevels(x, ch.levels), levels.rgb)));
    });
    lut[i * 4 + 3] = lumaCurve(x);
  }
  return lut;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
