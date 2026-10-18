import { useState, type ReactNode } from "react";
import type { EditSettings } from "../edit/settings";

/** What every tool panel receives. */
export interface ToolProps {
  settings: EditSettings;
  onChange: (patch: Partial<EditSettings>) => void;
}

export function ToolSection({
  title,
  changed,
  onReset,
  children,
}: {
  title: string;
  changed: boolean;
  onReset: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className="tool">
      <header className="tool-head">
        <button className="tool-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <span className="chevron">{open ? "▾" : "▸"}</span>
          {title}
          {changed && <span className="dot" title="Edited" />}
        </button>
        <button className="tool-reset" disabled={!changed} onClick={onReset} title={`Reset ${title}`}>
          Reset
        </button>
      </header>
      {open && <div className="tool-body">{children}</div>}
    </section>
  );
}

export function ChannelTabs<T extends string>({
  options,
  value,
  edited,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  /** Channels with edits get a dot. */
  edited: (id: T) => boolean;
  onChange: (id: T) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {options.map((o) => (
        <button
          key={o.id}
          role="tab"
          aria-selected={o.id === value}
          className={o.id === value ? "active" : undefined}
          onClick={() => onChange(o.id)}
        >
          {o.label}
          {edited(o.id) && <span className="dot" />}
        </button>
      ))}
    </div>
  );
}

/** SVG path for a filled histogram scaled to width × height. */
export function histogramPath(bins: Float32Array, width: number, height: number): string {
  const step = width / (bins.length - 1);
  let d = `M0 ${height}`;
  bins.forEach((v, i) => {
    d += ` L${(i * step).toFixed(2)} ${(height - Math.sqrt(v) * height * 0.95).toFixed(2)}`;
  });
  return `${d} L${width} ${height} Z`;
}

export const CHANNEL_COLORS = {
  rgb: "#9a9a9a",
  luma: "#9a9a9a",
  r: "#e5564e",
  g: "#4fbf5a",
  b: "#4f8fe5",
} as const;
