import { describe, expect, it } from "vitest";
import { hueToRgb, LUMA, wheelOffset } from "./color";

describe("hueToRgb", () => {
  it("returns the primaries and secondaries", () => {
    expect(hueToRgb(0)).toEqual([1, 0, 0]);
    expect(hueToRgb(60)).toEqual([1, 1, 0]);
    expect(hueToRgb(120)).toEqual([0, 1, 0]);
    expect(hueToRgb(240)).toEqual([0, 0, 1]);
    expect(hueToRgb(360)).toEqual([1, 0, 0]);
    expect(hueToRgb(-120)).toEqual([0, 0, 1]);
  });
});

describe("wheelOffset", () => {
  it("is zero at zero saturation", () => {
    expect(wheelOffset({ hue: 200, saturation: 0 }, 0.3)).toEqual([0, 0, 0]);
  });

  it("shifts color without changing luma", () => {
    for (const hue of [0, 45, 130, 210, 300]) {
      const o = wheelOffset({ hue, saturation: 100 }, 0.3);
      expect(o[0] * LUMA[0] + o[1] * LUMA[1] + o[2] * LUMA[2]).toBeCloseTo(0);
    }
  });

  it("pushes toward the chosen hue", () => {
    const [r, g, b] = wheelOffset({ hue: 0, saturation: 50 }, 0.3);
    expect(r).toBeGreaterThan(0);
    expect(g).toBeLessThan(0);
    expect(b).toBeLessThan(0);
  });
});
