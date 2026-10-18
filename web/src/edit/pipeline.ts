import { LUMA, STRENGTH, wheelOffset, type Vec3 } from "./color";
import { buildLut, LUT_SIZE } from "./lut";
import { BW_COLORS, type CurveChannel, type CurvePoint, type EditSettings, type Levels, type LevelsChannel } from "./settings";

// A CPU copy of the preview shader (render/shaders.ts), used where the GPU
// isn't available: matching a reference look in a worker, and tests.
// KEEP IN SYNC with the shader: every constant and step below mirrors it.

export interface PreparedEdit {
  gains: Vec3;
  exposureGain: number;
  shadows: number;
  highlights: number;
  whites: number;
  blacks: number;
  brightnessPower: number;
  contrast: number;
  saturation: number;
  lut: Float32Array;
  bwEnabled: boolean;
  bwSensitivity: number[];
  bwHighlightTone: Vec3;
  bwShadowTone: Vec3;
  cbMaster: Vec3;
  cbShadows: Vec3;
  cbMidtones: Vec3;
  cbHighlights: Vec3;
  cbLightness: Vec3;
}

// Building the LUT is the slow part; reuse it while levels and curves are unchanged.
const lutCache = new WeakMap<Record<LevelsChannel, Levels>, WeakMap<Record<CurveChannel, CurvePoint[]>, Float32Array>>();

function cachedLut(levels: Record<LevelsChannel, Levels>, curves: Record<CurveChannel, CurvePoint[]>): Float32Array {
  let byCurves = lutCache.get(levels);
  if (!byCurves) lutCache.set(levels, (byCurves = new WeakMap()));
  let lut = byCurves.get(curves);
  if (!lut) byCurves.set(curves, (lut = buildLut(levels, curves)));
  return lut;
}

export function prepareEdit(s: EditSettings): PreparedEdit {
  const t = s.temperature / 100;
  const raw: Vec3 = [1 + 0.3 * t, 1 - 0.3 * (s.tint / 100), 1 - 0.3 * t];
  const norm = dot(raw, LUMA);
  const cb = s.colorBalance;
  const k = STRENGTH.lightness / 100;
  return {
    gains: [raw[0] / norm, raw[1] / norm, raw[2] / norm],
    exposureGain: Math.pow(2, s.exposure),
    shadows: s.shadows / 100,
    highlights: s.highlights / 100,
    whites: s.whites / 100,
    blacks: s.blacks / 100,
    brightnessPower: Math.pow(2, -0.8 * (s.brightness / 100)),
    contrast: s.contrast / 100,
    saturation: s.saturation / 100,
    lut: cachedLut(s.levels, s.curves),
    bwEnabled: s.blackWhite.enabled,
    bwSensitivity: BW_COLORS.map((c) => s.blackWhite.sensitivity[c] / 100),
    bwHighlightTone: wheelOffset(s.blackWhite.highlightTone, STRENGTH.splitTone),
    bwShadowTone: wheelOffset(s.blackWhite.shadowTone, STRENGTH.splitTone),
    cbMaster: wheelOffset(cb.master, STRENGTH.master),
    cbShadows: wheelOffset(cb.shadows, STRENGTH.zone),
    cbMidtones: wheelOffset(cb.midtones, STRENGTH.zone),
    cbHighlights: wheelOffset(cb.highlights, STRENGTH.zone),
    cbLightness: [cb.shadows.lightness * k, cb.midtones.lightness * k, cb.highlights.lightness * k],
  };
}

/** Applies an edit to RGB triplets in display (sRGB) space, 0–1. Returns a new array. */
export function applyEdit(pixels: Float32Array, p: PreparedEdit): Float32Array {
  const out = new Float32Array(pixels.length);
  const c: Vec3 = [0, 0, 0];
  for (let i = 0; i < pixels.length; i += 3) {
    c[0] = pixels[i];
    c[1] = pixels[i + 1];
    c[2] = pixels[i + 2];
    applyToPixel(c, p);
    out[i] = c[0];
    out[i + 1] = c[1];
    out[i + 2] = c[2];
  }
  return out;
}

function applyToPixel(c: Vec3, p: PreparedEdit): void {
  // Linear light: white balance, exposure.
  for (let i = 0; i < 3; i++) {
    c[i] = linearToSrgb(clamp01(srgbToLinear(c[i]) * p.gains[i] * p.exposureGain));
  }

  // Display space: tone, brightness, contrast, saturation.
  let l = dot(c, LUMA);
  const dl = toneLuma(l, p) - l;
  for (let i = 0; i < 3; i++) {
    let v = Math.pow(clamp01(c[i] + dl), p.brightnessPower);
    if (p.contrast >= 0) v = mix(v, v * v * (3 - 2 * v), p.contrast);
    else v = mix(v, 0.5 + (v - 0.5) * 0.5, -p.contrast);
    c[i] = v;
  }
  l = dot(c, LUMA);
  for (let i = 0; i < 3; i++) c[i] = clamp01(mix(l, c[i], 1 + p.saturation));

  // Levels and curves.
  for (let i = 0; i < 3; i++) c[i] = lutAt(p.lut, c[i], i);
  l = dot(c, LUMA);
  const dLuma = lutAt(p.lut, l, 3) - l;
  for (let i = 0; i < 3; i++) c[i] = clamp01(c[i] + dLuma);

  // Black & white.
  if (p.bwEnabled) {
    const chroma = Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]);
    const h = hue6(c);
    let adjust = 0;
    for (let i = 0; i < 6; i++) {
      let d = Math.abs(h - i);
      d = Math.min(d, 6 - d);
      adjust += p.bwSensitivity[i] * Math.max(0, 1 - d);
    }
    const g = clamp01(dot(c, LUMA) * (1 + adjust * chroma));
    for (let i = 0; i < 3; i++) {
      c[i] = clamp01(g + p.bwHighlightTone[i] * g * g + p.bwShadowTone[i] * (1 - g) * (1 - g));
    }
  }

  // Color balance.
  l = dot(c, LUMA);
  const ws = (1 - l) * (1 - l);
  const wm = 2 * l * (1 - l);
  const wh = l * l;
  const light = p.cbLightness[0] * ws + p.cbLightness[1] * wm + p.cbLightness[2] * wh;
  for (let i = 0; i < 3; i++) {
    c[i] = clamp01(c[i] + p.cbMaster[i] + p.cbShadows[i] * ws + p.cbMidtones[i] * wm + p.cbHighlights[i] * wh + light);
  }
}

function toneLuma(l: number, p: PreparedEdit): number {
  return (
    l +
    p.shadows * 0.35 * 12.2 * l * Math.pow(1 - l, 4) +
    p.highlights * 0.35 * 12.2 * Math.pow(l, 4) * (1 - l) +
    p.whites * 0.25 * Math.pow(l, 4) +
    p.blacks * 0.15 * Math.pow(1 - l, 4)
  );
}

/** Linear interpolation between LUT entries, as the GPU's texture filtering does. */
function lutAt(lut: Float32Array, x: number, channel: number): number {
  const pos = clamp01(x) * (LUT_SIZE - 1);
  const i = Math.floor(pos);
  const j = Math.min(i + 1, LUT_SIZE - 1);
  const f = pos - i;
  return lut[i * 4 + channel] * (1 - f) + lut[j * 4 + channel] * f;
}

function hue6(c: Vec3): number {
  const mx = Math.max(c[0], c[1], c[2]);
  const d = mx - Math.min(c[0], c[1], c[2]);
  if (d <= 0) return 0;
  if (mx === c[0]) return ((((c[1] - c[2]) / d) % 6) + 6) % 6;
  if (mx === c[1]) return (c[2] - c[0]) / d + 2;
  return (c[0] - c[1]) / d + 4;
}

export function srgbToLinear(v: number): number {
  return v < 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function linearToSrgb(v: number): number {
  return v < 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
