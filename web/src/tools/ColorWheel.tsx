import { useRef, type PointerEvent } from "react";
import type { ColorWheelValue } from "../edit/settings";

// Hue runs counterclockwise from red at the right (3 o'clock), so the conic
// gradient (which runs clockwise from its start) lists hues in reverse.
const WHEEL_BACKGROUND = [
  "radial-gradient(circle closest-side, #808080 0%, rgba(128, 128, 128, 0) 100%)",
  "conic-gradient(from 90deg, hsl(0 85% 55%), hsl(300 85% 55%), hsl(240 85% 55%), hsl(180 85% 55%), hsl(120 85% 55%), hsl(60 85% 55%), hsl(0 85% 55%))",
].join(", ");

const NEUTRAL: ColorWheelValue = { hue: 0, saturation: 0 };

/** Drag to pick hue (angle) and saturation (distance from center). Double-click resets. */
export function ColorWheel({
  label,
  value,
  size,
  onChange,
}: {
  label: string;
  value: ColorWheelValue;
  size: number;
  onChange: (value: ColorWheelValue) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const pick = (e: PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const saturation = Math.round(Math.min(1, Math.hypot(dx, dy) / (r.width / 2)) * 100);
    const hue = Math.round((((Math.atan2(-dy, dx) * 180) / Math.PI) + 360) % 360);
    onChange({ hue: saturation === 0 ? 0 : hue, saturation });
  };

  const angle = (value.hue * Math.PI) / 180;
  const radius = (value.saturation / 100) * 50;

  return (
    <div className="wheel-block">
      <div className="wheel-label">{label}</div>
      <div
        ref={ref}
        className="wheel"
        style={{ width: size, height: size, background: WHEEL_BACKGROUND }}
        role="slider"
        aria-label={`${label} color`}
        aria-valuetext={`hue ${value.hue}°, saturation ${value.saturation}`}
        title="Drag to set color. Double-click to reset."
        onPointerDown={(e) => {
          dragging.current = true;
          ref.current!.setPointerCapture(e.pointerId);
          pick(e);
        }}
        onPointerMove={(e) => dragging.current && pick(e)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
        onDoubleClick={() => onChange(NEUTRAL)}
      >
        <div
          className="wheel-puck"
          style={{ left: `${50 + radius * Math.cos(angle)}%`, top: `${50 - radius * Math.sin(angle)}%` }}
        />
      </div>
      <div className="wheel-readout">
        {value.saturation === 0 ? "Neutral" : `${value.hue}° · ${value.saturation}`}
      </div>
    </div>
  );
}
