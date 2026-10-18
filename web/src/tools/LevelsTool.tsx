import { useState } from "react";
import { DEFAULT_LEVELS, DEFAULT_SETTINGS, sameValue, type Levels, type LevelsChannel } from "../edit/settings";
import type { Histogram } from "../render/histogram";
import { Slider } from "./Slider";
import { CHANNEL_COLORS, ChannelTabs, histogramPath, ToolSection, type ToolProps } from "./common";

const CHANNELS: { id: LevelsChannel; label: string }[] = [
  { id: "rgb", label: "RGB" },
  { id: "r", label: "Red" },
  { id: "g", label: "Green" },
  { id: "b", label: "Blue" },
];

const W = 256;
const H = 80;

export function LevelsTool({ settings, onChange, histogram }: ToolProps & { histogram: Histogram | null }) {
  const [channel, setChannel] = useState<LevelsChannel>("rgb");
  const lv = settings.levels[channel];
  const set = (patch: Partial<Levels>) =>
    onChange({ levels: { ...settings.levels, [channel]: { ...lv, ...patch } } });

  const bins = histogram ? histogram[channel === "rgb" ? "luma" : channel] : null;
  // The input value that comes out as middle gray.
  const mid = lv.inBlack + (lv.inWhite - lv.inBlack) * Math.pow(0.5, lv.gamma);

  return (
    <ToolSection
      title="Levels"
      changed={!sameValue(settings.levels, DEFAULT_SETTINGS.levels)}
      onReset={() => onChange({ levels: DEFAULT_SETTINGS.levels })}
    >
      <ChannelTabs
        options={CHANNELS}
        value={channel}
        edited={(id) => !sameValue(settings.levels[id], DEFAULT_LEVELS)}
        onChange={setChannel}
      />
      <svg className="levels-graph" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {bins && <path d={histogramPath(bins, W, H)} fill={CHANNEL_COLORS[channel]} opacity={0.45} />}
        <rect x={0} y={0} width={lv.inBlack} height={H} className="levels-clip" />
        <rect x={lv.inWhite} y={0} width={W - lv.inWhite} height={H} className="levels-clip" />
        <line x1={lv.inBlack} x2={lv.inBlack} y1={0} y2={H} className="levels-marker" />
        <line x1={mid} x2={mid} y1={0} y2={H} className="levels-marker mid" />
        <line x1={lv.inWhite} x2={lv.inWhite} y1={0} y2={H} className="levels-marker" />
      </svg>
      <Slider
        id="levels-in-black"
        label="Input black"
        value={lv.inBlack}
        min={0}
        max={254}
        step={1}
        defaultValue={DEFAULT_LEVELS.inBlack}
        onChange={(v) => set({ inBlack: Math.min(v, lv.inWhite - 1) })}
      />
      <Slider
        id="levels-midtone"
        label="Midtone"
        value={Math.log2(lv.gamma)}
        min={-3}
        max={3}
        step={0.01}
        defaultValue={0}
        format={(v) => Math.pow(2, v).toFixed(2)}
        onChange={(v) => set({ gamma: Math.pow(2, v) })}
      />
      <Slider
        id="levels-in-white"
        label="Input white"
        value={lv.inWhite}
        min={1}
        max={255}
        step={1}
        defaultValue={DEFAULT_LEVELS.inWhite}
        onChange={(v) => set({ inWhite: Math.max(v, lv.inBlack + 1) })}
      />
      <Slider
        id="levels-out-black"
        label="Output black"
        value={lv.outBlack}
        min={0}
        max={255}
        step={1}
        defaultValue={DEFAULT_LEVELS.outBlack}
        onChange={(v) => set({ outBlack: v })}
      />
      <Slider
        id="levels-out-white"
        label="Output white"
        value={lv.outWhite}
        min={0}
        max={255}
        step={1}
        defaultValue={DEFAULT_LEVELS.outWhite}
        onChange={(v) => set({ outWhite: v })}
      />
    </ToolSection>
  );
}
