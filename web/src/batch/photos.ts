import type { ImageStats } from "../edit/analyze";
import { DEFAULT_SETTINGS, type EditSettings } from "../edit/settings";
import type { Histogram } from "../render/histogram";

// The batch: every photo in the project, each with its own settings.

export interface Photo {
  id: string;
  file: File;
  name: string;
  status: "loading" | "ready" | "error";
  error?: string;
  /** Small 8-bit image drawn in the grid with the photo's settings. */
  thumb?: HTMLCanvasElement;
  /** 64 px copy for analysis and look matching. */
  analysis?: Float32Array;
  histogram?: Histogram;
  /** Camera and exposure details, for raw files. */
  description?: string;
  width?: number;
  height?: number;
  settings: EditSettings;
  /** Settings from before the last Match look, for undo. */
  preMatch?: EditSettings;
  /** The photo's measured look right after the last match. */
  matched?: ImageStats;
}

export type LoadedData = Pick<Photo, "thumb" | "analysis" | "histogram" | "description" | "width" | "height">;

export interface BatchState {
  photos: Photo[];
  currentId: string | null;
  selected: ReadonlySet<string>;
  /** Where a shift-click range starts. */
  anchorId: string | null;
}

export type BatchAction =
  | { type: "add"; photos: Photo[] }
  | { type: "loaded"; id: string; data: LoadedData }
  | { type: "failed"; id: string; error: string }
  | { type: "settings"; ids: string[]; settings: EditSettings | ((p: Photo) => EditSettings) }
  | { type: "matched"; id: string; settings: EditSettings; matched: ImageStats }
  | { type: "undoMatch"; ids: string[] }
  | { type: "current"; id: string }
  | { type: "select"; id: string; mode: "only" | "toggle" | "range" }
  | { type: "selectAll" }
  | { type: "selectNone" }
  | { type: "remove"; ids: string[] };

export const EMPTY_BATCH: BatchState = { photos: [], currentId: null, selected: new Set(), anchorId: null };

let nextId = 0;

export function newPhoto(file: File): Photo {
  return { id: `p${nextId++}`, file, name: file.name, status: "loading", settings: DEFAULT_SETTINGS };
}

const byName = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export function batchReducer(state: BatchState, action: BatchAction): BatchState {
  const update = (ids: Iterable<string>, fn: (p: Photo) => Photo): Photo[] => {
    const set = new Set(ids);
    return state.photos.map((p) => (set.has(p.id) ? fn(p) : p));
  };

  switch (action.type) {
    case "add": {
      const photos = [...state.photos, ...action.photos].sort((a, b) => byName.compare(a.name, b.name));
      const added = new Set(action.photos.map((p) => p.id));
      const currentId = state.currentId ?? photos.find((p) => added.has(p.id))?.id ?? null;
      return { ...state, photos, currentId, selected: currentId ? new Set([currentId]) : state.selected, anchorId: currentId };
    }
    case "loaded":
      return { ...state, photos: update([action.id], (p) => ({ ...p, ...action.data, status: "ready" })) };
    case "failed":
      return { ...state, photos: update([action.id], (p) => ({ ...p, status: "error", error: action.error })) };
    case "settings":
      return {
        ...state,
        photos: update(action.ids, (p) => ({
          ...p,
          settings: typeof action.settings === "function" ? action.settings(p) : action.settings,
          // The measured "after" no longer describes the photo once it's edited by hand.
          matched: undefined,
        })),
      };
    case "matched":
      return {
        ...state,
        photos: update([action.id], (p) => ({
          ...p,
          preMatch: p.preMatch ?? p.settings,
          settings: action.settings,
          matched: action.matched,
        })),
      };
    case "undoMatch":
      return {
        ...state,
        photos: update(action.ids, (p) =>
          p.preMatch ? { ...p, settings: p.preMatch, preMatch: undefined, matched: undefined } : p,
        ),
      };
    case "current":
      return { ...state, currentId: action.id, selected: new Set([action.id]), anchorId: action.id };
    case "select": {
      const { id, mode } = action;
      if (mode === "only") return { ...state, currentId: id, selected: new Set([id]), anchorId: id };
      if (mode === "toggle") {
        const selected = new Set(state.selected);
        if (selected.has(id)) selected.delete(id);
        else selected.add(id);
        return { ...state, currentId: id, selected, anchorId: id };
      }
      const ids = state.photos.map((p) => p.id);
      const a = ids.indexOf(state.anchorId ?? id);
      const b = ids.indexOf(id);
      const range = ids.slice(Math.min(a, b), Math.max(a, b) + 1);
      return { ...state, currentId: id, selected: new Set(range) };
    }
    case "selectAll":
      return { ...state, selected: new Set(state.photos.map((p) => p.id)) };
    case "selectNone":
      return { ...state, selected: new Set() };
    case "remove": {
      const gone = new Set(action.ids);
      const photos = state.photos.filter((p) => !gone.has(p.id));
      const selected = new Set([...state.selected].filter((id) => !gone.has(id)));
      const currentId = state.currentId && !gone.has(state.currentId) ? state.currentId : (photos[0]?.id ?? null);
      return { ...state, photos, selected, currentId, anchorId: currentId };
    }
  }
}
