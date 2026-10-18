import { DEFAULT_CURVE, DEFAULT_SETTINGS, SLIDERS, sameValue, type ColorWheelValue, type EditSettings } from "./settings";

/** A short, plain list of what differs from default, e.g. "Exposure +0.42 EV". */
export function describeSettings(s: EditSettings): string[] {
  const lines: string[] = [];
  for (const def of SLIDERS) {
    const v = s[def.id];
    if (v === DEFAULT_SETTINGS[def.id]) continue;
    const shown = def.step < 1 ? v.toFixed(2) : String(v);
    lines.push(`${def.label} ${v > 0 ? "+" : ""}${shown}${def.unit ? ` ${def.unit}` : ""}`);
  }
  if (!sameValue(s.levels, DEFAULT_SETTINGS.levels)) lines.push("Levels");
  for (const [ch, label] of [["rgb", "RGB"], ["luma", "Luma"], ["r", "Red"], ["g", "Green"], ["b", "Blue"]] as const) {
    if (!sameValue(s.curves[ch], DEFAULT_CURVE)) lines.push(`${label} curve (${s.curves[ch].length} points)`);
  }
  const cb = s.colorBalance;
  const wheels = [
    ["Master", cb.master],
    ["Shadows", cb.shadows],
    ["Midtones", cb.midtones],
    ["Highlights", cb.highlights],
  ] as const;
  const tinted = wheels.filter(([, w]) => w.saturation > 0).map(([name, w]) => `${name.toLowerCase()} ${wheelText(w)}`);
  if (tinted.length) lines.push(`Color balance: ${tinted.join(", ")}`);
  if (s.blackWhite.enabled) {
    const tones = [
      ["highlights", s.blackWhite.highlightTone],
      ["shadows", s.blackWhite.shadowTone],
    ] as const;
    const toned = tones.filter(([, w]) => w.saturation > 0).map(([name, w]) => `${name} ${wheelText(w)}`);
    lines.push(toned.length ? `Black & white, split tones: ${toned.join(", ")}` : "Black & white");
  }
  return lines;
}

function wheelText(w: ColorWheelValue): string {
  return `${w.hue}° · ${w.saturation}`;
}
