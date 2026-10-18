import { memo, useEffect, useRef, type MouseEvent } from "react";
import { DEFAULT_SETTINGS, sameValue, type EditSettings } from "../edit/settings";
import { drawThumb } from "../render/thumbRenderer";
import type { Photo } from "./photos";

interface Props {
  photos: Photo[];
  currentId: string | null;
  selected: ReadonlySet<string>;
  showOriginal: boolean;
  /** "grid" fills the view; "strip" is the edit view's single row. */
  layout: "grid" | "strip";
  onSelect: (id: string, mode: "only" | "toggle" | "range") => void;
  onOpen: (id: string) => void;
}

export function PhotoGrid({ photos, currentId, selected, showOriginal, layout, onSelect, onOpen }: Props) {
  const click = (e: MouseEvent, id: string) => {
    onSelect(id, e.shiftKey ? "range" : e.metaKey || e.ctrlKey ? "toggle" : "only");
  };
  return (
    <div className={`photo-${layout}`} role="listbox" aria-multiselectable aria-label="Photos">
      {photos.map((p) => (
        <PhotoCell
          key={p.id}
          photo={p}
          settings={p.settings}
          current={p.id === currentId}
          selected={selected.has(p.id)}
          showOriginal={showOriginal}
          onClick={(e) => click(e, p.id)}
          onDoubleClick={() => onOpen(p.id)}
          scrollIntoView={layout === "strip" && p.id === currentId}
        />
      ))}
    </div>
  );
}

const PhotoCell = memo(function PhotoCell({
  photo,
  settings,
  current,
  selected,
  showOriginal,
  onClick,
  onDoubleClick,
  scrollIntoView,
}: {
  photo: Photo;
  settings: EditSettings;
  current: boolean;
  selected: boolean;
  showOriginal: boolean;
  onClick: (e: MouseEvent) => void;
  onDoubleClick: () => void;
  scrollIntoView: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (photo.thumb && canvasRef.current) drawThumb(photo.thumb, settings, showOriginal, canvasRef.current);
  }, [photo.thumb, settings, showOriginal]);

  useEffect(() => {
    if (scrollIntoView) cellRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [scrollIntoView]);

  const edited = !sameValue(settings, DEFAULT_SETTINGS);
  return (
    <div
      ref={cellRef}
      className={`photo-cell${selected ? " selected" : ""}${current ? " current" : ""}`}
      role="option"
      aria-selected={selected}
      title={photo.description ? `${photo.name}\n${photo.description}` : photo.name}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <div className="photo-frame">
        {photo.status === "ready" && <canvas ref={canvasRef} />}
        {photo.status === "loading" && <span className="photo-status">Loading…</span>}
        {photo.status === "error" && <span className="photo-status error">{photo.error}</span>}
      </div>
      <div className="photo-caption">
        <span className="photo-name">{photo.name}</span>
        {photo.preMatch && <span className="photo-badge" title="Look matched">Matched</span>}
        {!photo.preMatch && edited && <span className="dot" title="Edited" />}
      </div>
    </div>
  );
});
