import { describe, expect, it } from "vitest";
import { applyLevels, buildLut, LUT_SIZE, makeCurve } from "./lut";
import { DEFAULT_LEVELS, DEFAULT_SETTINGS } from "./settings";

describe("applyLevels", () => {
  it("is the identity at defaults", () => {
    for (const x of [0, 0.25, 0.5, 1]) expect(applyLevels(x, DEFAULT_LEVELS)).toBeCloseTo(x);
  });

  it("maps input black/white to output black/white and clips outside them", () => {
    const lv = { ...DEFAULT_LEVELS, inBlack: 51, inWhite: 204, outBlack: 10, outWhite: 245 };
    expect(applyLevels(0.2, lv)).toBeCloseTo(10 / 255);
    expect(applyLevels(0.8, lv)).toBeCloseTo(245 / 255);
    expect(applyLevels(0, lv)).toBeCloseTo(10 / 255);
    expect(applyLevels(1, lv)).toBeCloseTo(245 / 255);
  });

  it("brightens midtones when gamma > 1", () => {
    expect(applyLevels(0.5, { ...DEFAULT_LEVELS, gamma: 2 })).toBeCloseTo(Math.SQRT1_2);
  });
});

describe("makeCurve", () => {
  it("is the identity for the default two points", () => {
    const f = makeCurve(DEFAULT_SETTINGS.curves.rgb);
    for (const x of [0, 0.1, 0.5, 0.9, 1]) expect(f(x)).toBeCloseTo(x);
  });

  it("passes through every control point", () => {
    const pts = [
      { x: 0, y: 0.05 },
      { x: 0.3, y: 0.2 },
      { x: 0.7, y: 0.85 },
      { x: 1, y: 0.95 },
    ];
    const f = makeCurve(pts);
    for (const p of pts) expect(f(p.x)).toBeCloseTo(p.y);
  });

  it("never overshoots: rising points give a rising curve within range", () => {
    const f = makeCurve([
      { x: 0, y: 0 },
      { x: 0.2, y: 0.6 },
      { x: 0.25, y: 0.62 },
      { x: 1, y: 1 },
    ]);
    let prev = -1;
    for (let i = 0; i <= 200; i++) {
      const y = f(i / 200);
      expect(y).toBeGreaterThanOrEqual(prev - 1e-9);
      expect(y).toBeLessThanOrEqual(1);
      prev = y;
    }
  });

  it("is flat beyond moved end points", () => {
    const f = makeCurve([
      { x: 0.1, y: 0.2 },
      { x: 0.9, y: 0.8 },
    ]);
    expect(f(0)).toBeCloseTo(0.2);
    expect(f(1)).toBeCloseTo(0.8);
  });
});

describe("buildLut", () => {
  it("is the identity on every channel at defaults", () => {
    const lut = buildLut(DEFAULT_SETTINGS.levels, DEFAULT_SETTINGS.curves);
    expect(lut.length).toBe(LUT_SIZE * 4);
    for (const i of [0, 100, 511, LUT_SIZE - 1]) {
      const x = i / (LUT_SIZE - 1);
      for (let c = 0; c < 4; c++) expect(lut[i * 4 + c]).toBeCloseTo(x, 5);
    }
  });

  it("applies a channel curve only to that channel", () => {
    const curves = { ...DEFAULT_SETTINGS.curves, r: [{ x: 0, y: 1 }, { x: 1, y: 0 }] };
    const lut = buildLut(DEFAULT_SETTINGS.levels, curves);
    expect(lut[0]).toBeCloseTo(1); // red inverted
    expect(lut[1]).toBeCloseTo(0); // green untouched
  });
});
