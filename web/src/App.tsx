import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_SETTINGS, isDefault, type EditSettings, type SliderId } from "./edit/settings";
import { loadImage } from "./render/loadImage";
import { Renderer } from "./render/renderer";
import { SliderPanel } from "./SliderPanel";

interface OpenImage {
  name: string;
  width: number;
  height: number;
}

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [image, setImage] = useState<OpenImage | null>(null);
  const [settings, setSettings] = useState<EditSettings>(DEFAULT_SETTINGS);
  const [showOriginal, setShowOriginal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

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

  useEffect(() => {
    if (image) rendererRef.current?.render(settings, showOriginal);
  }, [image, settings, showOriginal]);

  const openFile = useCallback(async (file: File) => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    if (!file.type.startsWith("image/")) {
      setError(`${file.name} is not an image. Open a JPEG.`);
      return;
    }
    try {
      const loaded = await loadImage(file, renderer.maxTextureSize);
      renderer.setImage(loaded.source, loaded.width, loaded.height);
      setError(null);
      setSettings(DEFAULT_SETTINGS);
      setShowOriginal(false);
      setImage({ name: file.name, width: loaded.originalWidth, height: loaded.originalHeight });
    } catch {
      setError(`Could not open ${file.name}. Raw files are not supported yet; try a JPEG.`);
    }
  }, []);

  // "\" toggles before/after, as in Capture One and Lightroom.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "\\" && image) setShowOriginal((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [image]);

  const changeSlider = (id: SliderId, value: number) => setSettings((s) => ({ ...s, [id]: value }));

  return (
    <div className="app">
      <header className="toolbar">
        <span className="brand">AusEdit</span>
        <button onClick={() => fileInputRef.current?.click()}>Open photo…</button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void openFile(file);
            e.target.value = "";
          }}
        />
        {image && (
          <span className="file-info">
            {image.name} · {image.width} × {image.height}
          </span>
        )}
        <span className="spacer" />
        <button
          className={showOriginal ? "active" : undefined}
          disabled={!image}
          onClick={() => setShowOriginal((v) => !v)}
          title="Toggle with the \ key"
        >
          {showOriginal ? "Showing original" : "Show original"}
        </button>
        <button disabled={!image || isDefault(settings)} onClick={() => setSettings(DEFAULT_SETTINGS)}>
          Reset all
        </button>
      </header>

      <main
        className={`viewer${dragging ? " dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) void openFile(file);
        }}
      >
        <canvas ref={canvasRef} hidden={!image} />
        {!image && <div className="empty">Open a JPEG, or drag one here.</div>}
        {error && <div className="error">{error}</div>}
        {showOriginal && <div className="badge">Original</div>}
      </main>

      <aside className="sidebar">
        <SliderPanel settings={settings} disabled={!image} onChange={changeSlider} />
      </aside>
    </div>
  );
}
