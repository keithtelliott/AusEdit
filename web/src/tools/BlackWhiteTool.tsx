import { BW_COLORS, DEFAULT_SETTINGS, sameValue, type BlackWhite } from "../edit/settings";
import { ColorWheel } from "./ColorWheel";
import { Slider } from "./Slider";
import { ToolSection, type ToolProps } from "./common";

const SWATCHES: Record<(typeof BW_COLORS)[number], string> = {
  red: "#e5564e",
  yellow: "#e5c94e",
  green: "#4fbf5a",
  cyan: "#4ec9e5",
  blue: "#4f6fe5",
  magenta: "#d24ee5",
};

export function BlackWhiteTool({ settings, onChange }: ToolProps) {
  const bw = settings.blackWhite;
  const set = (patch: Partial<BlackWhite>) => onChange({ blackWhite: { ...bw, ...patch } });

  return (
    <ToolSection
      title="Black & white"
      changed={!sameValue(bw, DEFAULT_SETTINGS.blackWhite)}
      onReset={() => onChange({ blackWhite: DEFAULT_SETTINGS.blackWhite })}
    >
      <label className="checkbox">
        <input id="bw-enabled" type="checkbox" checked={bw.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
        Enable black &amp; white
      </label>
      <div className={bw.enabled ? undefined : "muted"}>
        <h3 className="tool-subhead">Color sensitivity</h3>
        {BW_COLORS.map((color) => (
          <Slider
            key={color}
            id={`bw-${color}`}
            label={
              <>
                <span className="swatch" style={{ background: SWATCHES[color] }} />
                {color[0].toUpperCase() + color.slice(1)}
              </>
            }
            value={bw.sensitivity[color]}
            min={-100}
            max={100}
            step={1}
            defaultValue={0}
            onChange={(v) => set({ sensitivity: { ...bw.sensitivity, [color]: v } })}
          />
        ))}
        <h3 className="tool-subhead">Split tones</h3>
        <div className="wheel-row two">
          <ColorWheel label="Highlights" value={bw.highlightTone} size={76} onChange={(v) => set({ highlightTone: v })} />
          <ColorWheel label="Shadows" value={bw.shadowTone} size={76} onChange={(v) => set({ shadowTone: v })} />
        </div>
      </div>
    </ToolSection>
  );
}
