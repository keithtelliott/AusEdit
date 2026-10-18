// The edit model. Every edit is a set of slider values, never pixels, so it
// can later be exported to Capture One (.cos) by a separate module.

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

export type EditSettings = Record<SliderId, number>;

export const DEFAULT_SETTINGS: EditSettings = Object.fromEntries(
  SLIDERS.map((s) => [s.id, 0]),
) as EditSettings;

export function isDefault(settings: EditSettings): boolean {
  return SLIDERS.every((s) => settings[s.id] === DEFAULT_SETTINGS[s.id]);
}
