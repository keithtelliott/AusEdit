import { DEFAULT_SETTINGS, sameValue, type ColorBalance, type ToneWheelValue } from "../edit/settings";
import { ColorWheel } from "./ColorWheel";
import { Slider } from "./Slider";
import { ToolSection, type ToolProps } from "./common";

const ZONES = [
  { id: "shadows", label: "Shadows" },
  { id: "midtones", label: "Midtones" },
  { id: "highlights", label: "Highlights" },
] as const;

/** Capture One-style Color Balance: a master wheel plus a 3-way shadows/midtones/highlights set. */
export function ColorBalanceTool({ settings, onChange }: ToolProps) {
  const cb = settings.colorBalance;
  const set = (patch: Partial<ColorBalance>) => onChange({ colorBalance: { ...cb, ...patch } });
  const setZone = (id: (typeof ZONES)[number]["id"], patch: Partial<ToneWheelValue>) =>
    set({ [id]: { ...cb[id], ...patch } });

  return (
    <ToolSection
      title="Color balance"
      changed={!sameValue(cb, DEFAULT_SETTINGS.colorBalance)}
      onReset={() => onChange({ colorBalance: DEFAULT_SETTINGS.colorBalance })}
    >
      <div className="wheel-master">
        <ColorWheel label="Master" value={cb.master} size={120} onChange={(v) => set({ master: v })} />
      </div>
      <div className="wheel-row">
        {ZONES.map((z) => (
          <ColorWheel
            key={z.id}
            label={z.label}
            value={cb[z.id]}
            size={76}
            onChange={(v) => setZone(z.id, { hue: v.hue, saturation: v.saturation })}
          />
        ))}
      </div>
      {ZONES.map((z) => (
        <Slider
          key={z.id}
          id={`cb-${z.id}-lightness`}
          label={`${z.label} lightness`}
          value={cb[z.id].lightness}
          min={-100}
          max={100}
          step={1}
          defaultValue={0}
          onChange={(v) => setZone(z.id, { lightness: v })}
        />
      ))}
    </ToolSection>
  );
}
