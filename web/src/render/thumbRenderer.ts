import type { EditSettings } from "../edit/settings";
import { Renderer } from "./renderer";

// One shared, off-screen WebGL renderer draws every grid thumbnail with its
// photo's settings, then copies the result into the thumbnail's own canvas.
// (Browsers allow only a handful of WebGL contexts, so not one per thumbnail.)

let renderer: Renderer | null = null;

export function drawThumb(thumb: HTMLCanvasElement, settings: EditSettings, original: boolean, target: HTMLCanvasElement): void {
  renderer ??= new Renderer(document.createElement("canvas"));
  renderer.setImage({ kind: "element", source: thumb, width: thumb.width, height: thumb.height });
  renderer.render(settings, original);
  if (target.width !== thumb.width || target.height !== thumb.height) {
    target.width = thumb.width;
    target.height = thumb.height;
  }
  // Copy in the same task as the draw, before the browser clears the WebGL canvas.
  target.getContext("2d")!.drawImage(renderer.canvas, 0, 0);
}
