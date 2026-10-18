import type { ColorWheelValue } from "./settings";

export type Vec3 = [number, number, number];

export const LUMA: Vec3 = [0.2126, 0.7152, 0.0722];

/** How far each color tool can push color at 100% saturation, in display-space units. */
export const STRENGTH = {
  master: 0.15,
  zone: 0.3,
  lightness: 0.25,
  splitTone: 0.3,
} as const;

/** Fully saturated RGB for a hue in degrees (0 = red, 120 = green, 240 = blue). */
export function hueToRgb(hue: number): Vec3 {
  const h = (((hue % 360) + 360) % 360) / 60;
  const x = 1 - Math.abs((h % 2) - 1);
  if (h < 1) return [1, x, 0];
  if (h < 2) return [x, 1, 0];
  if (h < 3) return [0, 1, x];
  if (h < 4) return [0, x, 1];
  if (h < 5) return [x, 0, 1];
  return [1, 0, x];
}

/**
 * A color shift that adds the wheel's hue without changing brightness:
 * the hue's RGB minus its own luma, scaled by saturation and `strength`
 * (the shift at 100% saturation).
 */
export function wheelOffset(wheel: ColorWheelValue, strength: number): Vec3 {
  if (wheel.saturation === 0) return [0, 0, 0];
  const rgb = hueToRgb(wheel.hue);
  const luma = rgb[0] * LUMA[0] + rgb[1] * LUMA[1] + rgb[2] * LUMA[2];
  const k = (wheel.saturation / 100) * strength;
  return [(rgb[0] - luma) * k, (rgb[1] - luma) * k, (rgb[2] - luma) * k];
}
