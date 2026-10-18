/** A small copy of an image as display-space RGB triplets, 0–1, for analysis. */
export function readPixels(source: CanvasImageSource & { width: number; height: number }, maxEdge = 64): Float32Array {
  const scale = Math.min(1, maxEdge / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not create a 2D canvas.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const out = new Float32Array((data.length / 4) * 3);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    out[j] = data[i] / 255;
    out[j + 1] = data[i + 1] / 255;
    out[j + 2] = data[i + 2] / 255;
  }
  return out;
}
