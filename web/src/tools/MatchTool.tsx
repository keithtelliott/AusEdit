import { useEffect, useMemo, useRef, useState } from "react";
import { analyze, MEDIAN, type ImageStats } from "../edit/analyze";
import { describeSettings } from "../edit/describe";
import type { MatchResult } from "../edit/match";
import type { MatchRequest } from "../edit/matchWorker";
import type { EditSettings } from "../edit/settings";
import { readPixels } from "../render/pixels";
import { ToolSection } from "./common";

interface Reference {
  name: string;
  url: string;
  stats: ImageStats;
}

interface Props {
  settings: EditSettings;
  /** Replaces all settings (a match sets every tool). */
  onApply: (settings: EditSettings) => void;
  /** Thumbnail of the open photo, or null when none is open. */
  target: Float32Array | null;
}

/** Choose a reference photo, compare its look with this photo's, and match it. */
export function MatchTool({ settings, onApply, target }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const [reference, setReference] = useState<Reference | null>(null);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [previous, setPrevious] = useState<EditSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetStats = useMemo(() => (target ? analyze(target) : null), [target]);

  // A new photo starts fresh: no match to show or undo.
  useEffect(() => {
    setResult(null);
    setPrevious(null);
  }, [target]);

  useEffect(() => () => workerRef.current?.terminate(), []);
  useEffect(
    () => () => {
      if (reference) URL.revokeObjectURL(reference.url);
    },
    [reference],
  );

  const chooseReference = async (file: File) => {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      setReference({ name: file.name, url, stats: analyze(readPixels(img)) });
      setResult(null);
      setError(null);
    } catch {
      URL.revokeObjectURL(url);
      setError(`Could not open ${file.name}. Choose a JPEG.`);
    }
  };

  const match = () => {
    if (!target || !reference) return;
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL("../edit/matchWorker.ts", import.meta.url), { type: "module" });
    }
    const worker = workerRef.current;
    const before = settings;
    setBusy(true);
    worker.onmessage = (e: MessageEvent<MatchResult>) => {
      setBusy(false);
      setResult(e.data);
      setPrevious(before);
      onApply(e.data.settings);
    };
    worker.onerror = () => {
      setBusy(false);
      setError("Matching failed. Try another reference photo.");
    };
    worker.postMessage({ target, reference: reference.stats } satisfies MatchRequest);
  };

  const undo = () => {
    if (!previous) return;
    onApply(previous);
    setPrevious(null);
    setResult(null);
  };

  return (
    <ToolSection title="Match look" changed={previous !== null} onReset={undo} resetLabel="Undo match">
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void chooseReference(file);
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
        <p className="tool-hint">Choose an example photo whose look you want this photo to match.</p>
      )}
      <div className="button-row">
        <button onClick={() => fileRef.current?.click()}>{reference ? "Change reference…" : "Choose reference…"}</button>
        <button className="primary" disabled={!reference || !target || busy} onClick={match}>
          {busy ? "Matching…" : "Match look"}
        </button>
      </div>
      {error && <p className="tool-error">{error}</p>}
      {reference && <StatsTable reference={reference.stats} photo={targetStats} matched={result?.after ?? null} />}
      {result && (
        <>
          <h3 className="tool-subhead">Settings applied</h3>
          <ul className="match-summary">
            {describeSettings(result.settings).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="tool-hint">Adjust any tool below to fine-tune. Undo match restores your earlier settings.</p>
        </>
      )}
    </ToolSection>
  );
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
