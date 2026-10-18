import { useState } from "react";
import { ToolSection } from "../tools/common";
import type { ExportSize } from "./export";

export interface ExportProgress {
  done: number;
  total: number;
  failed: string[];
  finished: boolean;
}

interface Props {
  total: number;
  selectedCount: number;
  canCopy: boolean;
  canPaste: boolean;
  onCopy: () => void;
  onPaste: () => void;
  onResetSelected: () => void;
  onRemoveSelected: () => void;
  exportProgress: ExportProgress | null;
  onExport: (size: ExportSize, which: "selected" | "all") => void;
}

/** Actions on several photos at once: copy and paste settings, reset, remove, export. */
export function BatchTool(p: Props) {
  const [size, setSize] = useState<ExportSize>("full");
  const exporting = p.exportProgress !== null && !p.exportProgress.finished;
  const n = p.selectedCount;
  const plural = (k: number) => `${k} photo${k === 1 ? "" : "s"}`;

  return (
    <ToolSection title="Batch" changed={false} onReset={() => {}} resetLabel="">
      <p className="tool-hint batch-count">
        {plural(p.total)} · {n} selected. Shift-click selects a range; ⌘/Ctrl-click adds one.
      </p>
      <div className="button-row">
        <button disabled={!p.canCopy} onClick={p.onCopy} title="Copy the open photo's settings">
          Copy settings
        </button>
        <button disabled={!p.canPaste || n === 0} onClick={p.onPaste} title="Paste copied settings onto the selected photos">
          Paste to {n > 1 ? plural(n) : "selected"}
        </button>
      </div>
      <div className="button-row">
        <button disabled={n === 0} onClick={p.onResetSelected}>
          Reset {n > 1 ? plural(n) : "selected"}
        </button>
        <button disabled={n === 0} onClick={p.onRemoveSelected}>
          Remove {n > 1 ? plural(n) : "selected"}
        </button>
      </div>

      <h3 className="tool-subhead">Export JPEGs</h3>
      <label className="radio">
        <input type="radio" name="export-size" checked={size === "full"} onChange={() => setSize("full")} />
        Full size
      </label>
      <label className="radio">
        <input type="radio" name="export-size" checked={size === "half"} onChange={() => setSize("half")} />
        Half size (faster for raw files)
      </label>
      <div className="button-row">
        <button className="primary" disabled={n === 0 || exporting} onClick={() => p.onExport(size, "selected")}>
          Export {n > 1 ? plural(n) : "selected"}
        </button>
        <button disabled={p.total === 0 || exporting} onClick={() => p.onExport(size, "all")}>
          Export all
        </button>
      </div>
      {p.exportProgress && (
        <>
          <progress className="progress" value={p.exportProgress.done} max={p.exportProgress.total} />
          <p className="tool-hint" role="status">
            {p.exportProgress.finished
              ? `Exported ${p.exportProgress.done - p.exportProgress.failed.length} of ${p.exportProgress.total}.`
              : `Exporting ${p.exportProgress.done + 1} of ${p.exportProgress.total}…`}
          </p>
          {p.exportProgress.failed.length > 0 && (
            <p className="tool-error">Could not export: {p.exportProgress.failed.join(", ")}</p>
          )}
        </>
      )}
      <p className="tool-hint">Capture One settings files come once the export format is mapped (build phase 1).</p>
    </ToolSection>
  );
}
