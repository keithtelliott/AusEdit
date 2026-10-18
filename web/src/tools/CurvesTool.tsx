import { useMemo, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { makeCurve } from "../edit/lut";
import { DEFAULT_CURVE, DEFAULT_SETTINGS, sameValue, type CurveChannel, type CurvePoint } from "../edit/settings";
import type { Histogram } from "../render/histogram";
import { CHANNEL_COLORS, ChannelTabs, histogramPath, ToolSection, type ToolProps } from "./common";

const CHANNELS: { id: CurveChannel; label: string }[] = [
  { id: "rgb", label: "RGB" },
  { id: "luma", label: "Luma" },
  { id: "r", label: "Red" },
  { id: "g", label: "Green" },
  { id: "b", label: "Blue" },
];

export function CurvesTool({ settings, onChange, histogram }: ToolProps & { histogram: Histogram | null }) {
  const [channel, setChannel] = useState<CurveChannel>("rgb");
  const bins = histogram ? histogram[channel === "rgb" ? "luma" : channel] : null;
  return (
    <ToolSection
      title="Curves"
      changed={!sameValue(settings.curves, DEFAULT_SETTINGS.curves)}
      onReset={() => onChange({ curves: DEFAULT_SETTINGS.curves })}
    >
      <ChannelTabs
        options={CHANNELS}
        value={channel}
        edited={(id) => !sameValue(settings.curves[id], DEFAULT_CURVE)}
        onChange={setChannel}
      />
      <CurveEditor
        points={settings.curves[channel]}
        color={CHANNEL_COLORS[channel]}
        bins={bins}
        onChange={(points) => onChange({ curves: { ...settings.curves, [channel]: points } })}
      />
      <p className="tool-hint">Click to add a point. Drag a point off the graph, or double-click it, to remove it.</p>
    </ToolSection>
  );
}

const MAX_POINTS = 16;
/** Pointer distance (as a fraction of the graph) that grabs an existing point. */
const HIT = 0.04;
/** Neighboring points keep at least this much horizontal space. */
const GAP = 0.01;
/** How far past the edge an inner point must be dragged to delete it. */
const REMOVE_MARGIN = 0.1;

function CurveEditor({
  points,
  color,
  bins,
  onChange,
}: {
  points: CurvePoint[];
  color: string;
  bins: Float32Array | null;
  onChange: (points: CurvePoint[]) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragIndex = useRef<number | null>(null);
  const [removing, setRemoving] = useState(false);
  const curve = useMemo(() => makeCurve(points), [points]);

  const curvePath = useMemo(() => {
    let d = "";
    for (let i = 0; i <= 100; i++) d += `${i === 0 ? "M" : " L"}${i} ${(100 - curve(i / 100) * 100).toFixed(2)}`;
    return d;
  }, [curve]);

  const toLocal = (e: PointerEvent | MouseEvent): CurvePoint => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: 1 - (e.clientY - r.top) / r.height };
  };

  const nearest = (p: CurvePoint): number => {
    let best = -1;
    let bestDist = HIT;
    points.forEach((q, i) => {
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < bestDist) {
        best = i;
        bestDist = d;
      }
    });
    return best;
  };

  const isInner = (i: number) => i > 0 && i < points.length - 1;

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const p = toLocal(e);
    let i = nearest(p);
    if (i < 0) {
      if (points.length >= MAX_POINTS) return;
      const x = clamp(p.x, 0, 1);
      // Only insert between the end points, keeping the gap to both neighbors.
      i = points.findIndex((q) => q.x > x);
      if (i <= 0 || x - points[i - 1].x < GAP || points[i].x - x < GAP) return;
      onChange([...points.slice(0, i), { x, y: curve(x) }, ...points.slice(i)]);
    }
    dragIndex.current = i;
    svgRef.current!.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const i = dragIndex.current;
    if (i === null || i >= points.length) return;
    const p = toLocal(e);
    const lo = i > 0 ? points[i - 1].x + GAP : 0;
    const hi = i < points.length - 1 ? points[i + 1].x - GAP : 1;
    const outside = p.x < -REMOVE_MARGIN || p.x > 1 + REMOVE_MARGIN || p.y < -REMOVE_MARGIN || p.y > 1 + REMOVE_MARGIN;
    setRemoving(outside && isInner(i));
    const next = [...points];
    next[i] = { x: clamp(p.x, lo, hi), y: clamp(p.y, 0, 1) };
    onChange(next);
  };

  const onPointerUp = () => {
    const i = dragIndex.current;
    if (i !== null && removing && isInner(i)) onChange(points.filter((_, j) => j !== i));
    dragIndex.current = null;
    setRemoving(false);
  };

  const onDoubleClick = (e: MouseEvent<SVGSVGElement>) => {
    const i = nearest(toLocal(e));
    if (isInner(i)) onChange(points.filter((_, j) => j !== i));
  };

  return (
    <svg
      ref={svgRef}
      className="curve-editor"
      viewBox="0 0 100 100"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
    >
      {bins && <path d={histogramPath(bins, 100, 100)} fill={color} opacity={0.25} />}
      {[25, 50, 75].map((v) => (
        <g key={v} className="curve-grid">
          <line x1={v} x2={v} y1={0} y2={100} />
          <line x1={0} x2={100} y1={v} y2={v} />
        </g>
      ))}
      <line x1={0} y1={100} x2={100} y2={0} className="curve-baseline" />
      <path d={curvePath} stroke={color} className="curve-line" />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x * 100}
          cy={100 - p.y * 100}
          r={2.2}
          className="curve-point"
          opacity={removing && dragIndex.current === i ? 0.3 : 1}
        />
      ))}
    </svg>
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
