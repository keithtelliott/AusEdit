import { uint16ToHalf } from "./halfFloat";
import { computeHistogram, type Histogram } from "./histogram";
import { decodeRaw, isRawFile, rawToDisplay } from "./raw";

/** What the renderer uploads: a decoded 8-bit image, or 16-bit floats from a raw file. */
export type TextureImage =
  | { kind: "element"; source: TexImageSource; width: number; height: number }
  | { kind: "half"; data: Uint16Array; width: number; height: number };

export interface LoadedImage {
  texture: TextureImage;
  /** An 8-bit copy for the histogram and look analysis. */
  preview: HTMLCanvasElement;
  /** Size of the original file, before any downscaling for preview. */
  originalWidth: number;
  originalHeight: number;
  histogram: Histogram;
  /** Camera and exposure details, for raw files. */
  description?: string;
}

/** Longest edge of the preview texture. Full-resolution rendering comes with export. */
const PREVIEW_MAX_EDGE = 4096;
/** Longest edge of the 8-bit analysis copy of a raw file. */
const ANALYSIS_EDGE = 1024;

export async function loadImage(file: File, maxTextureSize: number): Promise<LoadedImage> {
  const maxEdge = Math.min(PREVIEW_MAX_EDGE, maxTextureSize);
  return isRawFile(file.name) ? loadRaw(file, maxEdge) : loadEncoded(file, maxEdge);
}

/**
 * Decodes a JPEG (or any browser-supported image) and scales it to preview
 * size. Going through an <img> applies the camera's EXIF rotation.
 */
async function loadEncoded(file: File, maxEdge: number): Promise<LoadedImage> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();

    const originalWidth = img.naturalWidth;
    const originalHeight = img.naturalHeight;
    const scale = Math.min(1, maxEdge / Math.max(originalWidth, originalHeight));
    const canvas = makeCanvas(Math.round(originalWidth * scale), Math.round(originalHeight * scale));
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    return {
      texture: { kind: "element", source: canvas, width: canvas.width, height: canvas.height },
      preview: canvas,
      originalWidth,
      originalHeight,
      histogram: computeHistogram(canvas),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function loadRaw(file: File, maxEdge: number): Promise<LoadedImage> {
  const decoded = await decodeRaw(file);
  let { width, height } = decoded;
  let data = rawToDisplay(decoded.data);
  const { fullWidth, fullHeight, description } = decoded;

  // Half-size decoding already fits typical screens; shrink further only if needed.
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
    texture: { kind: "half", data: uint16ToHalf(data), width, height },
    preview,
    originalWidth: fullWidth,
    originalHeight: fullHeight,
    histogram: computeHistogram(preview),
    description,
  };
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
