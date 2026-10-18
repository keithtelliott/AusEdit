// The edit model. Every edit is a set of values, never pixels, so it can later
// be exported to Capture One (.cos) by a separate module. Tools mirror
// Capture One's: Levels, Curves, Color Balance, Black & White.

export type SliderId =
  | "exposure"
  | "temperature"
  | "tint"
  | "contrast"
  | "brightness"
  | "saturation"
  | "highlights"
  | "shadows"
  | "whites"
  | "blacks";

export interface SliderDef {
  id: SliderId;
  label: string;
  min: number;
  max: number;
  step: number;
  /** Shown after the value, e.g. "EV". */
  unit?: string;
}

export interface SliderGroup {
  title: string;
  sliders: SliderDef[];
}

const pct = (id: SliderId, label: string): SliderDef => ({ id, label, min: -100, max: 100, step: 1 });

export const SLIDER_GROUPS: SliderGroup[] = [
  {
    title: "White balance",
    // Relative shifts for now. Capture One stores Kelvin for raw files;
    // the export module will convert.
    sliders: [pct("temperature", "Temperature"), pct("tint", "Tint")],
  },
  {
    title: "Exposure",
    sliders: [
      { id: "exposure", label: "Exposure", min: -4, max: 4, step: 0.01, unit: "EV" },
      pct("contrast", "Contrast"),
      pct("brightness", "Brightness"),
      pct("saturation", "Saturation"),
    ],
  },
  {
    title: "High dynamic range",
    sliders: [
      pct("highlights", "Highlights"),
      pct("shadows", "Shadows"),
      pct("whites", "Whites"),
      pct("blacks", "Blacks"),
    ],
  },
];

export const SLIDERS: SliderDef[] = SLIDER_GROUPS.flatMap((g) => g.sliders);

export type SliderValues = Record<SliderId, number>;

// Levels: black/white points on Capture One's 0–255 scale; gamma > 1 brightens midtones.
export type LevelsChannel = "rgb" | "r" | "g" | "b";
export interface Levels {
  inBlack: number;
  inWhite: number;
  gamma: number;
  outBlack: number;
  outWhite: number;
}

// Curves: control points on 0–1 for both axes, sorted by x.
export type CurveChannel = "rgb" | "luma" | "r" | "g" | "b";
export interface CurvePoint {
  x: number;
  y: number;
}

/** A color wheel position: hue in degrees (0 = red, 120 = green, 240 = blue), saturation 0–100. */
export interface ColorWheelValue {
  hue: number;
  saturation: number;
}

export interface ToneWheelValue extends ColorWheelValue {
  /** -100–100 */
  lightness: number;
}

export interface ColorBalance {
  master: ColorWheelValue;
  shadows: ToneWheelValue;
  midtones: ToneWheelValue;
  highlights: ToneWheelValue;
}

export const BW_COLORS = ["red", "yellow", "green", "cyan", "blue", "magenta"] as const;
export type BwColor = (typeof BW_COLORS)[number];

export interface BlackWhite {
  enabled: boolean;
  /** Color sensitivity, -100–100: how bright each source color turns out in gray. */
  sensitivity: Record<BwColor, number>;
  highlightTone: ColorWheelValue;
  shadowTone: ColorWheelValue;
}

export interface EditSettings extends SliderValues {
  levels: Record<LevelsChannel, Levels>;
  curves: Record<CurveChannel, CurvePoint[]>;
  colorBalance: ColorBalance;
  blackWhite: BlackWhite;
}

export const DEFAULT_LEVELS: Levels = { inBlack: 0, inWhite: 255, gamma: 1, outBlack: 0, outWhite: 255 };

export const DEFAULT_CURVE: CurvePoint[] = [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
];

const NO_COLOR: ColorWheelValue = { hue: 0, saturation: 0 };
const NO_TONE: ToneWheelValue = { hue: 0, saturation: 0, lightness: 0 };

export const DEFAULT_SETTINGS: EditSettings = {
  ...(Object.fromEntries(SLIDERS.map((s) => [s.id, 0])) as SliderValues),
  levels: { rgb: DEFAULT_LEVELS, r: DEFAULT_LEVELS, g: DEFAULT_LEVELS, b: DEFAULT_LEVELS },
  curves: { rgb: DEFAULT_CURVE, luma: DEFAULT_CURVE, r: DEFAULT_CURVE, g: DEFAULT_CURVE, b: DEFAULT_CURVE },
  colorBalance: { master: NO_COLOR, shadows: NO_TONE, midtones: NO_TONE, highlights: NO_TONE },
  blackWhite: {
    enabled: false,
    sensitivity: { red: 0, yellow: 0, green: 0, cyan: 0, blue: 0, magenta: 0 },
    highlightTone: NO_COLOR,
    shadowTone: NO_COLOR,
  },
};

/** Settings are plain data and never mutated, so a structural compare is enough. */
export function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function isDefault(settings: EditSettings): boolean {
  return sameValue(settings, DEFAULT_SETTINGS);
}
