import { DEFAULT_SETTINGS, SLIDER_GROUPS, type SliderValues } from "../edit/settings";
import { Slider } from "./Slider";
import { ToolSection, type ToolProps } from "./common";

/** White balance, Exposure and High dynamic range: one section per slider group. */
export function BasicTools({ settings, onChange }: ToolProps) {
  return (
    <>
      {SLIDER_GROUPS.map((group) => {
        const changed = group.sliders.some((s) => settings[s.id] !== DEFAULT_SETTINGS[s.id]);
        const reset = Object.fromEntries(group.sliders.map((s) => [s.id, DEFAULT_SETTINGS[s.id]])) as Partial<SliderValues>;
        return (
          <ToolSection key={group.title} title={group.title} changed={changed} onReset={() => onChange(reset)}>
            {group.sliders.map((def) => (
              <Slider
                key={def.id}
                id={def.id}
                label={def.label}
                value={settings[def.id]}
                min={def.min}
                max={def.max}
                step={def.step}
                unit={def.unit}
                defaultValue={DEFAULT_SETTINGS[def.id]}
                onChange={(v) => onChange({ [def.id]: v })}
              />
            ))}
          </ToolSection>
        );
      })}
    </>
  );
}
