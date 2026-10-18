import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { BatchTool, type ExportProgress } from "./batch/BatchTool";
import { chooseDestination, exportPhotos, type ExportSize } from "./batch/export";
import { enqueueImport } from "./batch/importer";
import { PhotoGrid } from "./batch/PhotoGrid";
import { batchReducer, EMPTY_BATCH, newPhoto } from "./batch/photos";
import { matchMany } from "./edit/matchPool";
import { DEFAULT_SETTINGS, isDefault, type EditSettings } from "./edit/settings";
import { loadImage, type LoadedImage } from "./render/loadImage";
import { isRawFile, RAW_EXTENSIONS } from "./render/raw";
import { Renderer } from "./render/renderer";
import { BasicTools } from "./tools/BasicTools";
import { BlackWhiteTool } from "./tools/BlackWhiteTool";
import { ColorBalanceTool } from "./tools/ColorBalanceTool";
import { CurvesTool } from "./tools/CurvesTool";
import { LevelsTool } from "./tools/LevelsTool";
import { loadReference, MatchTool, type Reference } from "./tools/MatchTool";

const ACCEPT = ["image/jpeg", "image/png", "image/webp", ...RAW_EXTENSIONS.map((e) => `.${e}`)].join(",");
/** Full previews kept in memory, so flipping between recent photos is instant. */
const PREVIEW_CACHE = 3;
/** Longest edge of the editor's preview texture. Full resolution comes with export. */
const PREVIEW_MAX_EDGE = 4096;

type View = "grid" | "edit";

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const previews = useRef(new Map<string, LoadedImage>());

  const [batch, dispatch] = useReducer(batchReducer, EMPTY_BATCH);
  const [view, setView] = useState<View>("grid");
  const [showOriginal, setShowOriginal] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [reference, setReference] = useState<Reference | null>(null);
  const [matchProgress, setMatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<EditSettings | null>(null);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);

  const current = batch.photos.find((p) => p.id === batch.currentId) ?? null;
  const selectedPhotos = batch.photos.filter((p) => batch.selected.has(p.id));
  const editable = current?.status === "ready";

  useEffect(() => {
    if (!canvasRef.current) return;
    try {
      rendererRef.current = new Renderer(canvasRef.current);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, []);

  // In the edit view, decode the open photo's full preview (or reuse a recent one).
  useEffect(() => {
    const renderer = rendererRef.current;
    if (view !== "edit" || !current || current.status !== "ready" || !renderer || loadedId === current.id) return;
    let cancelled = false;
    const cached = previews.current.get(current.id);
    const load = cached
      ? Promise.resolve(cached)
      : (setOpening(true), loadImage(current.file, "preview", Math.min(PREVIEW_MAX_EDGE, renderer.maxTextureSize)));
    load
      .then((loaded) => {
        remember(previews.current, current.id, loaded);
        if (cancelled) return;
        renderer.setImage(loaded.texture!);
        setLoadedId(current.id);
        setError(null);
      })
      .catch((e) => {
        console.error(e);
        if (!cancelled) setError(`Could not open ${current.name}.`);
      })
      .finally(() => !cancelled && setOpening(false));
    return () => {
      cancelled = true;
    };
    // Only a different photo (or its import finishing) needs a new preview; edits don't.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, current?.id, current?.status, loadedId]);

  useEffect(() => {
    if (view === "edit" && current && loadedId === current.id) rendererRef.current?.render(current.settings, showOriginal);
  }, [view, current, loadedId, showOriginal]);

  const addFiles = useCallback((files: File[]) => {
    const usable = files.filter((f) => isRawFile(f.name) || f.type.startsWith("image/"));
    if (usable.length < files.length) {
      setError(`Skipped ${files.length - usable.length} file(s) that aren't photos.`);
    } else {
      setError(null);
    }
    if (!usable.length) return;
    const photos = usable.map(newPhoto);
    dispatch({ type: "add", photos });
    enqueueImport(photos, dispatch);
  }, []);

  const step = useCallback(
    (delta: number) => {
      const i = batch.photos.findIndex((p) => p.id === batch.currentId);
      const next = batch.photos[i + delta];
      if (next) dispatch({ type: "current", id: next.id });
    },
    [batch.photos, batch.currentId],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inField = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (e.key === "\\") setShowOriginal((v) => !v);
      else if (inField) return;
      else if (view === "edit" && e.key === "ArrowRight") step(1);
      else if (view === "edit" && e.key === "ArrowLeft") step(-1);
      else if (view === "edit" && e.key === "Escape") setView("grid");
      else if (view === "grid" && e.key === "Enter" && current) setView("edit");
      else if (view === "grid" && e.key === "a" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        dispatch({ type: "selectAll" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, step, current]);

  const updateCurrent = useCallback(
    (patch: Partial<EditSettings>) => {
      if (batch.currentId) dispatch({ type: "settings", ids: [batch.currentId], settings: (p) => ({ ...p.settings, ...patch }) });
    },
    [batch.currentId],
  );

  const chooseReference = async (file: File) => {
    try {
      const ref = await loadReference(file);
      setReference((old) => {
        if (old) URL.revokeObjectURL(old.url);
        return ref;
      });
      setMatchError(null);
    } catch {
      setMatchError(`Could not open ${file.name}. Choose a JPEG.`);
    }
  };

  const matchSelected = () => {
    if (!reference) return;
    const jobs = selectedPhotos.filter((p) => p.analysis).map((p) => ({ id: p.id, target: p.analysis! }));
    if (!jobs.length) return;
    setMatchError(null);
    setMatchProgress({ done: 0, total: jobs.length });
    matchMany(jobs, reference.stats, (id, result) => {
      dispatch({ type: "matched", id, settings: result.settings, matched: result.after });
      setMatchProgress((p) => p && { ...p, done: p.done + 1 });
    })
      .catch((e) => {
        console.error(e);
        setMatchError("Matching failed. Try another reference photo.");
      })
      .finally(() => setMatchProgress(null));
  };

  const exportSelected = async (size: ExportSize, which: "selected" | "all") => {
    const photos = (which === "all" ? batch.photos : selectedPhotos).filter((p) => p.status === "ready");
    if (!photos.length) return;
    const destination = await chooseDestination();
    if (!destination) return;
    const total = photos.length;
    setExportProgress({ done: 0, total, failed: [], finished: false });
    await exportPhotos(photos, size, destination, (done, failed) =>
      setExportProgress({ done, total, failed: [...failed], finished: false }),
    );
    setExportProgress((p) => p && { ...p, finished: true });
  };

  const removeSelected = () => {
    const ids = [...batch.selected];
    ids.forEach((id) => previews.current.delete(id));
    if (loadedId && batch.selected.has(loadedId)) setLoadedId(null);
    dispatch({ type: "remove", ids });
  };

  const targetIds = batch.selected.size ? [...batch.selected] : batch.currentId ? [batch.currentId] : [];
  const histogram = current?.histogram ?? null;
  const settings = current?.settings ?? DEFAULT_SETTINGS;
  const empty = batch.photos.length === 0;

  return (
    <div className="app">
      <header className="toolbar">
        <span className="brand">AusEdit</span>
        <button onClick={() => fileInputRef.current?.click()}>Add photos…</button>
        <button onClick={() => folderInputRef.current?.click()}>Add folder…</button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            addFiles([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
        <input
          ref={folderInputRef}
          type="file"
          hidden
          {...{ webkitdirectory: "" }}
          onChange={(e) => {
            addFiles([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
        <div className="tabs view-tabs" role="tablist">
          {(["grid", "edit"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              className={view === v ? "active" : undefined}
              disabled={v === "edit" && !current}
              onClick={() => setView(v)}
            >
              {v === "grid" ? "Grid" : "Edit"}
            </button>
          ))}
        </div>
        {current && (
          <span className="file-info">
            {current.name}
            {current.width && ` · ${current.width} × ${current.height}`}
            {current.description && ` · ${current.description}`}
          </span>
        )}
        <span className="spacer" />
        <button
          className={showOriginal ? "active" : undefined}
          disabled={empty}
          onClick={() => setShowOriginal((v) => !v)}
          title="Toggle with the \ key"
        >
          {showOriginal ? "Showing original" : "Show original"}
        </button>
        <button disabled={!current || isDefault(settings)} onClick={() => updateCurrent(DEFAULT_SETTINGS)}>
          Reset photo
        </button>
      </header>

      <main
        className={`main ${view}${dragging ? " dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles([...e.dataTransfer.files]);
        }}
      >
        <div className="viewer" hidden={view !== "edit"}>
          <canvas ref={canvasRef} hidden={loadedId !== current?.id} />
          {opening && <div className="badge opening">Opening {current?.name}…</div>}
          {showOriginal && <div className="badge">Original</div>}
        </div>
        {empty ? (
          <div className="empty">
            Add photos to start: JPEGs or camera raw files, one or a whole folder.
            <br />
            You can also drag them here.
          </div>
        ) : (
          <PhotoGrid
            photos={batch.photos}
            currentId={batch.currentId}
            selected={batch.selected}
            showOriginal={showOriginal}
            layout={view === "grid" ? "grid" : "strip"}
            onSelect={(id, mode) => dispatch({ type: "select", id, mode })}
            onOpen={(id) => {
              dispatch({ type: "current", id });
              setView("edit");
            }}
          />
        )}
        {error && <div className="error">{error}</div>}
        {showOriginal && view === "grid" && <div className="badge">Originals</div>}
      </main>

      <aside className="sidebar">
        <MatchTool
          reference={reference}
          onChooseReference={chooseReference}
          photo={current}
          selectedCount={selectedPhotos.filter((p) => p.status === "ready").length}
          progress={matchProgress}
          error={matchError}
          onMatch={matchSelected}
          onUndo={() => dispatch({ type: "undoMatch", ids: targetIds })}
        />
        <BatchTool
          total={batch.photos.length}
          selectedCount={batch.selected.size}
          canCopy={!!current}
          canPaste={clipboard !== null}
          onCopy={() => current && setClipboard(current.settings)}
          onPaste={() => clipboard && dispatch({ type: "settings", ids: [...batch.selected], settings: clipboard })}
          onResetSelected={() => dispatch({ type: "settings", ids: [...batch.selected], settings: DEFAULT_SETTINGS })}
          onRemoveSelected={removeSelected}
          exportProgress={exportProgress}
          onExport={exportSelected}
        />
        <div className={editable ? undefined : "disabled"}>
          <BasicTools settings={settings} onChange={updateCurrent} />
          <LevelsTool settings={settings} onChange={updateCurrent} histogram={histogram} />
          <CurvesTool settings={settings} onChange={updateCurrent} histogram={histogram} />
          <ColorBalanceTool settings={settings} onChange={updateCurrent} />
          <BlackWhiteTool settings={settings} onChange={updateCurrent} />
        </div>
      </aside>
    </div>
  );
}

/** Keeps the most recent PREVIEW_CACHE previews. */
function remember(cache: Map<string, LoadedImage>, id: string, loaded: LoadedImage): void {
  cache.delete(id);
  cache.set(id, loaded);
  while (cache.size > PREVIEW_CACHE) cache.delete(cache.keys().next().value!);
}
