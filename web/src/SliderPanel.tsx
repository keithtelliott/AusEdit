import { DEFAULT_SETTINGS, SLIDER_GROUPS, type EditSettings, type SliderDef, type SliderId } from "./edit/settings";

interface Props {
  settings: EditSettings;
  disabled: boolean;
  onChange: (id: SliderId, value: number) => void;
}

export function SliderPanel({ settings, disabled, onChange }: Props) {
  return (
    <div className="panel">
      {SLIDER_GROUPS.map((group) => (
        <section key={group.title} className="panel-group">
          <h2>{group.title}</h2>
          {group.sliders.map((def) => (
            <SliderRow
              key={def.id}
              def={def}
              value={settings[def.id]}
              disabled={disabled}
              onChange={(v) => onChange(def.id, v)}
            />
          ))}
        </section>
      ))}
      <p className="panel-hint">Double-click a slider's name to reset it.</p>
    </div>
  );
}

function SliderRow({
  def,
  value,
  disabled,
  onChange,
}: {
  def: SliderDef;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const decimals = def.step < 1 ? 2 : 0;
  const shown = `${value > 0 ? "+" : ""}${value.toFixed(decimals)}${def.unit ? ` ${def.unit}` : ""}`;
  return (
    <div className={`slider-row${value !== DEFAULT_SETTINGS[def.id] ? " changed" : ""}`}>
      <div className="slider-head">
        <label htmlFor={`slider-${def.id}`} onDoubleClick={() => onChange(DEFAULT_SETTINGS[def.id])} title="Double-click to reset">
          {def.label}
        </label>
        <span className="slider-value">{shown}</span>
      </div>
      <input
        id={`slider-${def.id}`}
        type="range"
        min={def.min}
        max={def.max}
        step={def.step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        onDoubleClick={() => onChange(DEFAULT_SETTINGS[def.id])}
      />
    </div>
  );
}
