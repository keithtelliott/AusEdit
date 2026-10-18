import { loadImage } from "../render/loadImage";
import { Renderer } from "../render/renderer";
import type { Photo } from "./photos";

// Renders each photo with its settings and saves it as a JPEG.

export type ExportSize = "full" | "half";

const JPEG_QUALITY = 0.92;

interface DirectoryHandle {
  getFileHandle(name: string, options: { create: boolean }): Promise<{
    createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
  }>;
}

type Destination = { kind: "folder"; dir: DirectoryHandle } | { kind: "downloads" };

/**
 * Asks where to save. Chrome and Edge can write into a chosen folder; other
 * browsers download each file. Must be called straight from a click.
 * Returns null if the person cancels.
 */
export async function chooseDestination(): Promise<Destination | null> {
  const picker = (window as unknown as { showDirectoryPicker?: (o: object) => Promise<DirectoryHandle> }).showDirectoryPicker;
  if (!picker) return { kind: "downloads" };
  try {
    return { kind: "folder", dir: await picker({ mode: "readwrite", id: "ausedit-export" }) };
  } catch {
    return null;
  }
}

export async function exportPhotos(
  photos: Photo[],
  size: ExportSize,
  destination: Destination,
  onProgress: (done: number, failed: string[]) => void,
): Promise<void> {
  const renderer = new Renderer(document.createElement("canvas"), true);
  const used = new Set<string>();
  const failed: string[] = [];
  try {
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      try {
        const loaded = await loadImage(photo.file, size, renderer.maxTextureSize);
        renderer.setImage(loaded.texture!);
        renderer.render(photo.settings, false);
        const blob = await new Promise<Blob | null>((r) => renderer.canvas.toBlob(r, "image/jpeg", JPEG_QUALITY));
        if (!blob) throw new Error("Could not encode JPEG.");
        await save(blob, outputName(photo.name, used), destination);
      } catch (e) {
        console.error(e);
        failed.push(photo.name);
      }
      onProgress(i + 1, failed);
    }
  } finally {
    renderer.dispose();
  }
}

/** "_DSC0009.ARW" → "_DSC0009.jpg", made unique if two photos share a base name. */
export function outputName(name: string, used: Set<string>): string {
  const base = name.replace(/\.[^.]+$/, "");
  let candidate = `${base}.jpg`;
  for (let n = 2; used.has(candidate.toLowerCase()); n++) candidate = `${base}-${n}.jpg`;
  used.add(candidate.toLowerCase());
  return candidate;
}

async function save(blob: Blob, name: string, destination: Destination): Promise<void> {
  if (destination.kind === "folder") {
    const file = await destination.dir.getFileHandle(name, { create: true });
    const writable = await file.createWritable();
    await writable.write(blob);
    await writable.close();
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
