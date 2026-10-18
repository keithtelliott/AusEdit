import { analyze, MEDIAN, type ImageStats, type Tint } from "./analyze";
import { applyEdit, prepareEdit } from "./pipeline";
import { DEFAULT_SETTINGS, type ColorWheelValue, type CurvePoint, type EditSettings } from "./settings";

// Finds slider settings that make a photo look like a reference. Each
// setting is searched in turn against the reference's measurements, so the
// result is ordinary, editable settings rather than baked-in pixels:
//   1. exposure, contrast, white balance, saturation (two rounds, since they interact)
//   2. a Luma curve for the remaining tone differences
//   3. Color Balance wheels for shadow/midtone/highlight tints
// A black & white reference turns on Black & White and fits split tones instead.

export interface MatchResult {
  settings: EditSettings;
  /** The photo as it was, as it will look, and the reference. */
  before: ImageStats;
  after: ImageStats;
  reference: ImageStats;
}

const ROUNDS = 2;
const SEARCH_STEPS = 18;
const ZONE_IDS = ["shadows", "midtones", "highlights"] as const;

/**
 * @param target the photo to edit, as display-space RGB triplets (a small thumbnail is plenty)
 * @param reference measurements of the photo to emulate
 */
export function matchLook(target: Float32Array, reference: ImageStats): MatchResult {
  const measure = (s: EditSettings) => analyze(applyEdit(target, prepareEdit(s)));
  const ref = reference;
  let s: EditSettings = { ...DEFAULT_SETTINGS };
  if (ref.mono) s = { ...s, blackWhite: { ...s.blackWhite, enabled: true } };

  /** Searches one number, keeping everything else in `s` fixed. */
  const fit = (lo: number, hi: number, step: number, apply: (v: number) => EditSettings, loss: (m: ImageStats) => number) => {
    const v = goldenSearch((x) => loss(measure(apply(x))), lo, hi);
    s = apply(Math.round(v / step) * step);
  };

  for (let round = 0; round < ROUNDS; round++) {
    fit(-3, 3, 0.01, (v) => ({ ...s, exposure: v }), (m) => sq(m.lightness[MEDIAN] - ref.lightness[MEDIAN]));
    fit(-100, 100, 1, (v) => ({ ...s, contrast: v }), (m) => sq(spread(m, 2, 4) - spread(ref, 2, 4)) + 0.5 * sq(spread(m, 1, 5) - spread(ref, 1, 5)));
    if (!ref.mono) {
      fit(-100, 100, 1, (v) => ({ ...s, temperature: v }), (m) => sq(m.b - ref.b) + sq(m.a - ref.a));
      fit(-100, 100, 1, (v) => ({ ...s, tint: v }), (m) => sq(m.b - ref.b) + sq(m.a - ref.a));
      fit(-100, 100, 1, (v) => ({ ...s, saturation: v }), (m) => sq(m.chroma - ref.chroma));
    }
  }

  s = { ...s, curves: { ...s.curves, luma: toneCurve(measure(s).luma, ref.luma) } };

  const zoneLoss = (m: ImageStats) =>
    ZONE_IDS.reduce((sum, z) => sum + tintDistance(m.zones[z], ref.zones[z]), 0);

  for (let round = 0; round < ROUNDS; round++) {
    if (ref.mono) {
      for (const key of ["shadowTone", "highlightTone"] as const) {
        fitWheel(s.blackWhite[key], (w) => ({ ...s, blackWhite: { ...s.blackWhite, [key]: w } }));
      }
    } else {
      for (const z of ZONE_IDS) {
        const cb = s.colorBalance;
        fitWheel(cb[z], (w) => ({ ...s, colorBalance: { ...s.colorBalance, [z]: { ...s.colorBalance[z], ...w } } }));
      }
    }
  }

  /** Searches a color wheel's horizontal then vertical position. */
  function fitWheel(start: ColorWheelValue, apply: (w: ColorWheelValue) => EditSettings) {
    let [x, y] = toXY(start);
    x = Math.round(goldenSearch((v) => zoneLoss(measure(apply(fromXY(v, y)))), -100, 100));
    y = Math.round(goldenSearch((v) => zoneLoss(measure(apply(fromXY(x, v)))), -100, 100));
    s = apply(fromXY(x, y));
  }

  return { settings: s, before: analyze(target), after: measure(s), reference: ref };
}

/**
 * A Luma curve that maps the photo's luma percentiles onto the reference's,
 * so shadows, midtones and highlights land at the same brightness.
 * Lifted blacks or dimmed whites in the reference (a faded or matte look)
 * become raised or lowered end points.
 */
export function toneCurve(photo: number[], reference: number[]): CurvePoint[] {
  const MIN_GAP = 0.03;
  const last = photo.length - 1;
  const points: CurvePoint[] = [{ x: 0, y: Math.max(0, reference[0] - photo[0]) }];
  for (let i = 1; i < last; i++) {
    const x = photo[i];
    if (x - points[points.length - 1].x < MIN_GAP || x > 1 - MIN_GAP) continue;
    points.push({ x, y: Math.max(reference[i], points[points.length - 1].y) });
  }
  const end = Math.min(1, 1 - Math.max(0, photo[last] - reference[last]));
  points.push({ x: 1, y: Math.max(end, points[points.length - 1].y) });
  return points.map((p) => ({ x: round3(p.x), y: round3(p.y) }));
}

/** Golden-section search for the minimum of `f` on [lo, hi]. */
export function goldenSearch(f: (x: number) => number, lo: number, hi: number, steps = SEARCH_STEPS): number {
  const g = (Math.sqrt(5) - 1) / 2;
  let a = lo;
  let b = hi;
  let c = b - g * (b - a);
  let d = a + g * (b - a);
  let fc = f(c);
  let fd = f(d);
  for (let i = 0; i < steps; i++) {
    if (fc < fd) {
      b = d;
      d = c;
      fd = fc;
      c = b - g * (b - a);
      fc = f(c);
    } else {
      a = c;
      c = d;
      fc = fd;
      d = a + g * (b - a);
      fd = f(d);
    }
  }
  return (a + b) / 2;
}

function toXY(w: ColorWheelValue): [number, number] {
  const angle = (w.hue * Math.PI) / 180;
  return [w.saturation * Math.cos(angle), w.saturation * Math.sin(angle)];
}

function fromXY(x: number, y: number): ColorWheelValue {
  const saturation = Math.min(100, Math.round(Math.hypot(x, y)));
  if (saturation === 0) return { hue: 0, saturation: 0 };
  return { hue: Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360), saturation };
}

function spread(m: ImageStats, lo: number, hi: number): number {
  return m.lightness[hi] - m.lightness[lo];
}

function tintDistance(p: Tint, q: Tint): number {
  return sq(p.a - q.a) + sq(p.b - q.b);
}

function sq(v: number): number {
  return v * v;
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}
