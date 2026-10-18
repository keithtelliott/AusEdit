import { describe, expect, it } from "vitest";
import { analyze, MEDIAN } from "./analyze";
import { goldenSearch, matchLook, toneCurve } from "./match";
import { applyEdit, prepareEdit } from "./pipeline";
import { DEFAULT_SETTINGS, type EditSettings } from "./settings";
import { testImage } from "./testImage";

const photo = testImage();

function edited(patch: Partial<EditSettings>): Float32Array {
  return applyEdit(photo, prepareEdit({ ...DEFAULT_SETTINGS, ...patch }));
}

describe("pipeline", () => {
  it("leaves the image unchanged at default settings", () => {
    const out = edited({});
    let maxDiff = 0;
    out.forEach((v, i) => (maxDiff = Math.max(maxDiff, Math.abs(v - photo[i]))));
    expect(maxDiff).toBeLessThan(0.002);
  });
});

describe("analyze", () => {
  it("measures a warm cast as positive b", () => {
    expect(analyze(edited({ temperature: 60 })).b).toBeGreaterThan(analyze(photo).b + 0.01);
  });

  it("flags black & white, including split-toned black & white, but not a color photo", () => {
    const bw = { ...DEFAULT_SETTINGS.blackWhite, enabled: true };
    expect(analyze(photo).mono).toBe(false);
    expect(analyze(edited({ blackWhite: bw })).mono).toBe(true);
    const toned = { ...bw, highlightTone: { hue: 40, saturation: 60 }, shadowTone: { hue: 220, saturation: 60 } };
    expect(analyze(edited({ blackWhite: toned })).mono).toBe(true);
  });
});

describe("matchLook", () => {
  it("leaves settings near default when matching a photo to itself", () => {
    const { settings } = matchLook(photo, analyze(photo));
    expect(Math.abs(settings.exposure)).toBeLessThan(0.1);
    expect(Math.abs(settings.contrast)).toBeLessThanOrEqual(8);
    expect(Math.abs(settings.temperature)).toBeLessThanOrEqual(5);
    expect(Math.abs(settings.saturation)).toBeLessThanOrEqual(5);
  });

  it("recovers a known color look", () => {
    const reference = analyze(
      edited({
        exposure: 0.6,
        contrast: 25,
        temperature: 35,
        saturation: -30,
        colorBalance: {
          ...DEFAULT_SETTINGS.colorBalance,
          shadows: { hue: 200, saturation: 40, lightness: 0 },
          highlights: { hue: 40, saturation: 30, lightness: 0 },
        },
      }),
    );
    const { after } = matchLook(photo, reference);
    expect(after.lightness[MEDIAN]).toBeCloseTo(reference.lightness[MEDIAN], 1);
    expect(Math.abs(after.a - reference.a)).toBeLessThan(0.006);
    expect(Math.abs(after.b - reference.b)).toBeLessThan(0.006);
    expect(Math.abs(after.chroma - reference.chroma)).toBeLessThan(0.01);
    for (const z of ["shadows", "highlights"] as const) {
      expect(Math.abs(after.zones[z].b - reference.zones[z].b)).toBeLessThan(0.008);
    }
    after.luma.forEach((v, i) => expect(Math.abs(v - reference.luma[i])).toBeLessThan(0.04));
  });

  it("turns on black & white for a black & white reference", () => {
    const bw = {
      ...DEFAULT_SETTINGS.blackWhite,
      enabled: true,
      highlightTone: { hue: 45, saturation: 50 },
    };
    const reference = analyze(edited({ blackWhite: bw }));
    const { settings, after } = matchLook(photo, reference);
    expect(settings.blackWhite.enabled).toBe(true);
    expect(after.mono).toBe(true);
    expect(Math.abs(after.zones.highlights.b - reference.zones.highlights.b)).toBeLessThan(0.006);
  });
});

describe("toneCurve", () => {
  it("is the identity when the percentiles already match", () => {
    const p = [0.02, 0.06, 0.3, 0.5, 0.7, 0.94, 0.98];
    for (const pt of toneCurve(p, p).slice(1, -1)) expect(pt.y).toBeCloseTo(pt.x, 3);
  });

  it("lifts the black point for a matte reference and stays rising", () => {
    const pts = toneCurve([0.01, 0.05, 0.3, 0.5, 0.7, 0.95, 0.99], [0.12, 0.15, 0.32, 0.5, 0.68, 0.9, 0.93]);
    expect(pts[0].y).toBeCloseTo(0.11, 2);
    for (let i = 1; i < pts.length; i++) {
      expect(pts[i].x).toBeGreaterThan(pts[i - 1].x);
      expect(pts[i].y).toBeGreaterThanOrEqual(pts[i - 1].y);
    }
  });
});

describe("goldenSearch", () => {
  it("finds the minimum of a parabola", () => {
    expect(goldenSearch((x) => (x - 1.3) ** 2, -3, 3, 40)).toBeCloseTo(1.3, 3);
  });
});
