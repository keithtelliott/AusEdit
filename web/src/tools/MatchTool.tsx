import { useRef } from "react";
import type { Photo } from "../batch/photos";
import { analyze, MEDIAN, type ImageStats } from "../edit/analyze";
import { describeSettings } from "../edit/describe";
import { readPixels } from "../render/pixels";
import { ToolSection } from "./common";

export interface Reference {
  name: string;
  url: string;
  stats: ImageStats;
}

/** Decodes a reference photo and measures its look. */
export async function loadReference(file: File): Promise<Reference> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { name: file.name, url, stats: analyze(readPixels(img)) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

interface Props {
  reference: Reference | null;
  onChooseReference: (file: File) => void;
  /** The open photo, or null when there is none. */
  photo: Photo | null;
  selectedCount: number;
  /** Photos matched so far in the running batch match, or null when idle. */
  progress: { done: number; total: number } | null;
  error: string | null;
  onMatch: () => void;
  onUndo: () => void;
}

/** Choose a reference photo, compare its look with the open photo's, and match the selected photos. */
export function MatchTool({ reference, onChooseReference, photo, selectedCount, progress, error, onMatch, onUndo }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const matchLabel = progress
    ? `Matching ${progress.done} of ${progress.total}…`
    : selectedCount > 1
      ? `Match ${selectedCount} photos`
      : "Match look";

  return (
    <ToolSection title="Match look" changed={!!photo?.preMatch} onReset={onUndo} resetLabel="Undo match">
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onChooseReference(file);
          e.target.value = "";
        }}
      />
      {reference ? (
        <div className="reference">
          <img src={reference.url} alt="Reference photo" />
          <div className="reference-name" title={reference.name}>
            {reference.name}
          </div>
        </div>
      ) : (
        <p className="tool-hint">Choose an example photo whose look you want your photos to match.</p>
      )}
      <div className="button-row">
        <button onClick={() => fileRef.current?.click()}>{reference ? "Change reference…" : "Choose reference…"}</button>
        <button className="primary" disabled={!reference || selectedCount === 0 || progress !== null} onClick={onMatch}>
          {matchLabel}
        </button>
      </div>
      {progress && <progress className="progress" value={progress.done} max={progress.total} />}
      {error && <p className="tool-error">{error}</p>}
      {reference && (
        <StatsTable
          reference={reference.stats}
          photo={photo?.analysis ? analyzeOnce(photo.analysis) : null}
          matched={photo?.matched ?? null}
        />
      )}
      {photo?.matched && (
        <>
          <h3 className="tool-subhead">Settings applied to this photo</h3>
          <ul className="match-summary">
            {describeSettings(photo.settings).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="tool-hint">Adjust any tool to fine-tune. Undo match restores the earlier settings.</p>
        </>
      )}
    </ToolSection>
  );
}

// Measuring a photo's look takes a few milliseconds; do it once per photo.
const statsCache = new WeakMap<Float32Array, ImageStats>();
function analyzeOnce(pixels: Float32Array): ImageStats {
  let stats = statsCache.get(pixels);
  if (!stats) statsCache.set(pixels, (stats = analyze(pixels)));
  return stats;
}

// Characteristics shown in the table, scaled to readable whole numbers.
const ROWS: { label: string; value: (s: ImageStats) => number | string; title: string }[] = [
  { label: "Brightness", value: (s) => s.lightness[MEDIAN] * 100, title: "Median lightness, 0–100" },
  { label: "Contrast", value: (s) => (s.lightness[4] - s.lightness[2]) * 100, title: "Spread of the middle half of tones" },
  { label: "Warmth", value: (s) => s.b * 1000, title: "Positive is yellow/warm, negative is blue/cool" },
  { label: "Tint", value: (s) => s.a * 1000, title: "Positive is magenta, negative is green" },
  { label: "Saturation", value: (s) => s.chroma * 1000, title: "Average colorfulness" },
  { label: "Shadow warmth", value: (s) => s.zones.shadows.b * 1000, title: "Warmth of the shadows alone" },
  { label: "Highlight warmth", value: (s) => s.zones.highlights.b * 1000, title: "Warmth of the highlights alone" },
  { label: "Black & white", value: (s) => (s.mono ? "Yes" : "No"), title: "No real color beyond a tint" },
];

function StatsTable({
  reference,
  photo,
  matched,
}: {
  reference: ImageStats;
  photo: ImageStats | null;
  matched: ImageStats | null;
}) {
  const cell = (s: ImageStats | null, row: (typeof ROWS)[number]) => {
    if (!s) return "–";
    const v = row.value(s);
    return typeof v === "string" ? v : Math.round(v);
  };
  return (
    <table className="stats">
      <thead>
        <tr>
          <th />
          <th>Reference</th>
          <th>This photo</th>
          {matched && <th>Matched</th>}
        </tr>
      </thead>
      <tbody>
        {ROWS.map((row) => (
          <tr key={row.label} title={row.title}>
            <th>{row.label}</th>
            <td>{cell(reference, row)}</td>
            <td>{cell(photo, row)}</td>
            {matched && <td>{cell(matched, row)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
