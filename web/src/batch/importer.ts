import type { Dispatch } from "react";
import { loadImage, scaleCanvas } from "../render/loadImage";
import { readPixels } from "../render/pixels";
import type { BatchAction, LoadedData, Photo } from "./photos";

// Decodes added photos in the background, a few at a time, keeping only what
// the grid and matching need. The full preview is decoded when a photo is opened.

/** Raw decodes run in parallel, each in its own LibRaw worker. */
const CONCURRENCY = 3;
/** Longest edge of grid thumbnails. */
export const THUMB_EDGE = 360;

const queue: Photo[] = [];
let active = 0;

export function enqueueImport(photos: Photo[], dispatch: Dispatch<BatchAction>): void {
  queue.push(...photos);
  pump(dispatch);
}

function pump(dispatch: Dispatch<BatchAction>): void {
  while (active < CONCURRENCY && queue.length) {
    const photo = queue.shift()!;
    active++;
    importOne(photo.file)
      .then((data) => dispatch({ type: "loaded", id: photo.id, data }))
      .catch((e) => {
        console.error(e);
        dispatch({ type: "failed", id: photo.id, error: "Could not open this file." });
      })
      .finally(() => {
        active--;
        pump(dispatch);
      });
  }
}

async function importOne(file: File): Promise<LoadedData> {
  const loaded = await loadImage(file, "thumbnail", Infinity);
  return {
    thumb: scaleCanvas(loaded.preview, THUMB_EDGE),
    analysis: readPixels(loaded.preview),
    histogram: loaded.histogram,
    description: loaded.description,
    width: loaded.originalWidth,
    height: loaded.originalHeight,
  };
}
