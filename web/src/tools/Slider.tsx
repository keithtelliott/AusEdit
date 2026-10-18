import { useId, type ReactNode } from "react";

interface Props {
  /** Becomes the input's id as `slider-<id>`. */
  id?: string;
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  onChange: (value: number) => void;
  unit?: string;
  /** Overrides the value readout. */
  format?: (value: number) => string;
  /** CSS background for a thin bar under the label, e.g. a hue gradient. */
  track?: string;
}

export function Slider({ id, label, value, min, max, step, defaultValue, onChange, unit, format, track }: Props) {
  const autoId = useId();
  const inputId = id ? `slider-${id}` : autoId;
  const decimals = step < 1 ? 2 : 0;
  const signed = min < 0 && value > 0 ? "+" : "";
  const shown = format ? format(value) : `${signed}${value.toFixed(decimals)}${unit ? ` ${unit}` : ""}`;
  const reset = () => onChange(defaultValue);
  return (
    <div className={`slider-row${value !== defaultValue ? " changed" : ""}`}>
      <div className="slider-head">
        <label htmlFor={inputId} onDoubleClick={reset} title="Double-click to reset">
          {label}
        </label>
        <span className="slider-value">{shown}</span>
      </div>
      {track && <div className="slider-track" style={{ background: track }} />}
      <input
        id={inputId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onDoubleClick={reset}
      />
    </div>
  );
}
