import { describe, expect, it } from "vitest";
import { isRawFile, RAW_BASELINE_EV, rawDisplayLinear, rawToDisplay } from "./raw";

describe("isRawFile", () => {
  it("recognizes raw extensions in any case", () => {
    expect(isRawFile("_DSC0009.ARW")).toBe(true);
    expect(isRawFile("a.cr3")).toBe(true);
    expect(isRawFile("photo.jpg")).toBe(false);
    expect(isRawFile("noextension")).toBe(false);
  });
});

describe("rawDisplayLinear", () => {
  const bt709 = (v: number) => (v < 0.018 ? 4.5 * v : 1.099 * Math.pow(v, 0.45) - 0.099);

  it("undoes LibRaw's BT.709 curve and applies the baseline exposure to midtones", () => {
    for (const scene of [0.01, 0.05, 0.1]) {
      expect(rawDisplayLinear(bt709(scene))).toBeCloseTo(scene * 2 ** RAW_BASELINE_EV, 4);
    }
  });

  it("maps black to black and rolls highlights off below white", () => {
    expect(rawDisplayLinear(0)).toBe(0);
    expect(rawDisplayLinear(1)).toBeLessThan(1);
    expect(rawDisplayLinear(1)).toBeGreaterThan(0.9);
  });

  it("only ever rises", () => {
    let prev = -1;
    for (let i = 0; i <= 1000; i++) {
      const v = rawDisplayLinear(i / 1000);
      expect(v).toBeGreaterThan(prev);
      prev = v;
    }
  });
});

describe("rawToDisplay", () => {
  it("keeps black at 0 and stays within 16 bits", () => {
    const out = rawToDisplay(new Uint16Array([0, 30000, 65535]));
    expect(out[0]).toBe(0);
    expect(out[1]).toBeGreaterThan(30000);
    expect(out[2]).toBeLessThanOrEqual(65535);
  });
});
