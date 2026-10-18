import type { LibRawSettings } from "libraw-wasm";
import { linearToSrgb } from "../edit/pipeline";

// Camera raw decoding in the browser with LibRaw compiled to WebAssembly.
// The library (about 1.4 MB) loads only when the first raw file is opened.
//
// LibRaw's output is "scene" light: correct colors, but darker and flatter
// than any raw editor shows by default. rawToDisplay adds the usual starting
// point: a baseline exposure and a soft highlight shoulder, then sRGB.

export const RAW_EXTENSIONS = ["arw", "cr2", "cr3", "nef", "dng", "raf", "orf", "rw2", "pef", "srw"];

export function isRawFile(name: string): boolean {
  return RAW_EXTENSIONS.includes(name.split(".").pop()?.toLowerCase() ?? "");
}

export interface DecodedRaw {
  /** Interleaved RGB, 16 bits per sample, BT.709 gamma (see rawToDisplay). */
  data: Uint16Array;
  width: number;
  height: number;
  /** Full sensor size; the preview is decoded at half size. */
  fullWidth: number;
  fullHeight: number;
  /** e.g. "Sony ILCE-7M3 · ISO 100 · 1/250 s · f/8 · 35 mm" */
  description: string;
}

export const RAW_SETTINGS: LibRawSettings = {
  // 2×2 binning instead of full demosaicing: a quarter of the pixels and much
  // faster, which suits on-screen editing. Full size comes with export.
  halfSize: true,
  useCameraWb: true,
  // sRGB primaries. libraw-wasm 1.6 ignores `gamm`, so the output always
  // carries LibRaw's default BT.709 curve (verified against sensor values);
  // rawToDisplay undoes it.
  outputColor: 1,
  outputBps: 16,
  // The same exposure always gives the same brightness (LibRaw's auto
  // brightening varies per photo), which keeps batches consistent.
  noAutoBright: true,
  // Clip highlights (LibRaw's default); recovery modes are a later improvement.
  highlight: 0,
};

/** Starting exposure for raw files, fitted to Apple's raw rendering of the A7 III samples. */
export const RAW_BASELINE_EV = 1.1;
/** Linear level where the highlight shoulder begins. */
const SHOULDER_START = 0.6;

/** One display value per 16-bit LibRaw sample, built on first use. */
let displayTable: Uint16Array | null = null;

/** LibRaw output (BT.709 gamma) to display values (sRGB gamma) with the baseline look. */
export function rawToDisplay(samples: Uint16Array): Uint16Array {
  if (!displayTable) {
    displayTable = new Uint16Array(65536);
    for (let i = 0; i < 65536; i++) {
      const linear = rawDisplayLinear(i / 65535);
      displayTable[i] = Math.round(linearToSrgb(linear) * 65535);
    }
  }
  const out = new Uint16Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = displayTable[samples[i]];
  return out;
}

/** BT.709-encoded LibRaw value to linear display light: baseline exposure, then a soft shoulder. */
export function rawDisplayLinear(encoded: number): number {
  const scene = encoded < 0.081 ? encoded / 4.5 : Math.pow((encoded + 0.099) / 1.099, 1 / 0.45);
  const v = scene * Math.pow(2, RAW_BASELINE_EV);
  if (v <= SHOULDER_START) return v;
  // Continues the straight line smoothly, then approaches white without clipping.
  const room = 1 - SHOULDER_START;
  return SHOULDER_START + room * (1 - Math.exp(-(v - SHOULDER_START) / room));
}

export async function decodeRaw(file: File, settings: LibRawSettings = RAW_SETTINGS): Promise<DecodedRaw> {
  const { default: LibRaw } = await import("libraw-wasm");
  const raw = new LibRaw();
  try {
    await raw.open(new Uint8Array(await file.arrayBuffer()), settings);
    const meta = await raw.metadata();
    const image = await raw.imageData();
    if (!image || !(image.data instanceof Uint16Array) || image.colors !== 3) {
      throw new Error("LibRaw returned an unexpected image format.");
    }
    return {
      data: image.data,
      width: image.width,
      height: image.height,
      fullWidth: meta?.width ?? image.width * 2,
      fullHeight: meta?.height ?? image.height * 2,
      description: meta ? describe(meta) : "",
    };
  } finally {
    raw.dispose();
  }
}

function describe(meta: { camera_make: string; camera_model: string; iso_speed: number; shutter: number; aperture: number; focal_len: number }): string {
  const parts = [`${meta.camera_make} ${meta.camera_model}`.trim()];
  if (meta.iso_speed) parts.push(`ISO ${Math.round(meta.iso_speed)}`);
  if (meta.shutter) parts.push(meta.shutter >= 1 ? `${meta.shutter} s` : `1/${Math.round(1 / meta.shutter)} s`);
  if (meta.aperture) parts.push(`f/${meta.aperture.toFixed(1).replace(/\.0$/, "")}`);
  if (meta.focal_len) parts.push(`${Math.round(meta.focal_len)} mm`);
  return parts.filter(Boolean).join(" · ");
}
