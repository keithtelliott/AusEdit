import { hueToRgb } from "./color";

/** A synthetic photo for tests: hue across, lightness down, with a gray strip. */
export function testImage(size = 48): Float32Array {
  const px = new Float32Array(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const light = 0.08 + (0.84 * y) / (size - 1);
      const sat = x < size / 8 ? 0 : 0.45;
      const hue = (x / size) * 360;
      const rgb = hueToRgb(hue);
      for (let c = 0; c < 3; c++) {
        px[(y * size + x) * 3 + c] = Math.min(1, light * (1 - sat) + rgb[c] * light * sat);
      }
    }
  }
  return px;
}
