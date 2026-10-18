import { uint16ToHalf } from "./halfFloat";
import { computeHistogram, type Histogram } from "./histogram";
import { decodeRaw, isRawFile, RAW_SETTINGS, rawToDisplay } from "./raw";

/** What the renderer uploads: a decoded 8-bit image, or 16-bit floats from a raw file. */
export type TextureImage =
  | { kind: "element"; source: TexImageSource; width: number; height: number }
  | { kind: "half"; data: Uint16Array; width: number; height: number };

export interface LoadedImage {
  /** Null when only the preview was asked for. */
  texture: TextureImage | null;
  /** An 8-bit copy (at most ANALYSIS_EDGE for raws) for the histogram, thumbnails and analysis. */
  preview: HTMLCanvasElement;
  /** Size of the original file, before any downscaling. */
  originalWidth: number;
  originalHeight: number;
  histogram: Histogram;
  /** Camera and exposure details, for raw files. */
  description?: string;
}

/**
 * - "preview": for the editor. Raws at half size; other images up to maxEdge.
 * - "thumbnail": for importing into the batch. Only the small preview, no texture.
 * - "half" / "full": for export.
 */
export type LoadSize = "preview" | "thumbnail" | "half" | "full";

/** Longest edge of the 8-bit preview used for analysis and thumbnails. */
const ANALYSIS_EDGE = 1024;

export async function loadImage(file: File, size: LoadSize, maxEdge: number): Promise<LoadedImage> {
  return isRawFile(file.name) ? loadRaw(file, size, maxEdge) : loadEncoded(file, size, maxEdge);
}

/**
 * Decodes a JPEG (or any browser-supported image). Going through an <img>
 * applies the camera's EXIF rotation.
 */
async function loadEncoded(file: File, size: LoadSize, maxEdge: number): Promise<LoadedImage> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();

    const originalWidth = img.naturalWidth;
    const originalHeight = img.naturalHeight;
    const edge = size === "thumbnail" ? ANALYSIS_EDGE : maxEdge;
    const want = size === "half" ? 0.5 : 1;
    const scale = Math.min(want, edge / Math.max(originalWidth, originalHeight));
    const canvas = makeCanvas(Math.round(originalWidth * scale), Math.round(originalHeight * scale));
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    return {
      texture: size === "thumbnail" ? null : { kind: "element", source: canvas, width: canvas.width, height: canvas.height },
      preview: canvas,
      originalWidth,
      originalHeight,
      histogram: computeHistogram(canvas),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function loadRaw(file: File, size: LoadSize, maxEdge: number): Promise<LoadedImage> {
  const decoded = await decodeRaw(file, { ...RAW_SETTINGS, halfSize: size !== "full" });
  let { width, height } = decoded;
  let data = rawToDisplay(decoded.data);
  const { fullWidth, fullHeight, description } = decoded;

  // Shrink further only if the GPU can't hold it.
  const step = Math.ceil(Math.max(width, height) / maxEdge);
  if (step > 1) ({ data, width, height } = subsample(data, width, height, step));

  const preview = makeCanvas(...fit(width, height, ANALYSIS_EDGE));
  const pStep = width / preview.width;
  const ctx = preview.getContext("2d")!;
  const pixels = ctx.createImageData(preview.width, preview.height);
  for (let y = 0; y < preview.height; y++) {
    for (let x = 0; x < preview.width; x++) {
      const src = (Math.floor(y * pStep) * width + Math.floor(x * pStep)) * 3;
      const dst = (y * preview.width + x) * 4;
      pixels.data[dst] = data[src] >> 8;
      pixels.data[dst + 1] = data[src + 1] >> 8;
      pixels.data[dst + 2] = data[src + 2] >> 8;
      pixels.data[dst + 3] = 255;
    }
  }
  ctx.putImageData(pixels, 0, 0);

  return {
    texture: size === "thumbnail" ? null : { kind: "half", data: uint16ToHalf(data), width, height },
    preview,
    originalWidth: fullWidth,
    originalHeight: fullHeight,
    histogram: computeHistogram(preview),
    description,
  };
}

/** A copy scaled to fit within maxEdge, for grid thumbnails. */
export function scaleCanvas(source: HTMLCanvasElement, maxEdge: number): HTMLCanvasElement {
  const canvas = makeCanvas(...fit(source.width, source.height, maxEdge));
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function subsample(data: Uint16Array, width: number, height: number, step: number) {
  const w = Math.floor(width / step);
  const h = Math.floor(height / step);
  const out = new Uint16Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const src = (y * step * width + x * step) * 3;
      const dst = (y * w + x) * 3;
      out[dst] = data[src];
      out[dst + 1] = data[src + 1];
      out[dst + 2] = data[src + 2];
    }
  }
  return { data: out, width: w, height: h };
}

function fit(width: number, height: number, maxEdge: number): [number, number] {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))];
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}
