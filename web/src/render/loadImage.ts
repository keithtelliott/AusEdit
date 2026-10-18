import { computeHistogram, type Histogram } from "./histogram";

export interface LoadedImage {
  source: HTMLCanvasElement;
  width: number;
  height: number;
  /** Size of the original file, before any downscaling for preview. */
  originalWidth: number;
  originalHeight: number;
  histogram: Histogram;
}

/** Longest edge of the preview texture. Full-resolution rendering comes with export. */
const PREVIEW_MAX_EDGE = 4096;

/**
 * Decodes a JPEG (or any browser-supported image) and scales it to preview
 * size. Going through an <img> applies the camera's EXIF rotation.
 */
export async function loadImage(file: File, maxTextureSize: number): Promise<LoadedImage> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();

    const originalWidth = img.naturalWidth;
    const originalHeight = img.naturalHeight;
    const maxEdge = Math.min(PREVIEW_MAX_EDGE, maxTextureSize);
    const scale = Math.min(1, maxEdge / Math.max(originalWidth, originalHeight));
    const width = Math.round(originalWidth * scale);
    const height = Math.round(originalHeight * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create a 2D canvas.");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, width, height);

    return { source: canvas, width, height, originalWidth, originalHeight, histogram: computeHistogram(canvas) };
  } finally {
    URL.revokeObjectURL(url);
  }
}
