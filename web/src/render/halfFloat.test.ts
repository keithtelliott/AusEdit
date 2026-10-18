import { describe, expect, it } from "vitest";
import { fromHalf, toHalf, uint16ToHalf } from "./halfFloat";

describe("half floats", () => {
  it("round-trips exactly representable values", () => {
    for (const v of [0, 1, 0.5, 0.25, 0.75, 2 ** -14]) expect(fromHalf(toHalf(v))).toBe(v);
  });

  it("keeps 16-bit samples within half-float precision across the range", () => {
    const samples = new Uint16Array([0, 1, 100, 1000, 32768, 65000, 65535]);
    uint16ToHalf(samples).forEach((h, i) => {
      const v = samples[i] / 65535;
      expect(Math.abs(fromHalf(h) - v)).toBeLessThanOrEqual(Math.max(v * 2 ** -11, 2 ** -25));
    });
  });

  it("resolves deep shadows far finer than 8 bits", () => {
    // Two samples less than one 8-bit step apart stay distinct.
    expect(uint16ToHalf(new Uint16Array([100]))[0]).not.toBe(uint16ToHalf(new Uint16Array([120]))[0]);
  });
});
