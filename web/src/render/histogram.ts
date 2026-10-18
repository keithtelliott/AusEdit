export interface Histogram {
  r: Float32Array;
  g: Float32Array;
  b: Float32Array;
  luma: Float32Array;
}

const BINS = 256;
const SAMPLE_EDGE = 512;

/**
 * 256-bin histograms of the original image, each scaled so its tallest bin
 * is 1. Computed from a small copy; exact counts don't matter for display.
 */
export function computeHistogram(source: HTMLCanvasElement): Histogram {
  const scale = Math.min(1, SAMPLE_EDGE / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not create a 2D canvas.");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  const r = new Float32Array(BINS);
  const g = new Float32Array(BINS);
  const b = new Float32Array(BINS);
  const luma = new Float32Array(BINS);
  for (let i = 0; i < data.length; i += 4) {
    r[data[i]]++;
    g[data[i + 1]]++;
    b[data[i + 2]]++;
    luma[Math.round(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2])]++;
  }
  return { r: normalize(r), g: normalize(g), b: normalize(b), luma: normalize(luma) };
}

function normalize(bins: Float32Array): Float32Array {
  // Ignore the end bins when finding the peak; clipped pixels would flatten the rest.
  let peak = 1;
  for (let i = 1; i < BINS - 1; i++) peak = Math.max(peak, bins[i]);
  return bins.map((v) => Math.min(1, v / peak));
}
