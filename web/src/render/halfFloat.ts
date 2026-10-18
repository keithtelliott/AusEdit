// Converts 0–1 numbers to 16-bit floats ("half floats") for WebGL textures:
// half the memory of 32-bit floats, and far finer than 8 bits in the shadows.

const f32 = new Float32Array(1);
const u32 = new Uint32Array(f32.buffer);

export function toHalf(value: number): number {
  f32[0] = value;
  const x = u32[0];
  const sign = (x >>> 16) & 0x8000;
  const exp = ((x >>> 23) & 0xff) - 127 + 15;
  const mantissa = x & 0x7fffff;
  if (exp <= 0) {
    // Too small for a normal half: subnormal, or zero.
    if (exp < -10) return sign;
    return sign | ((mantissa | 0x800000) >>> (14 - exp));
  }
  if (exp >= 31) return sign | 0x7c00;
  // Round to nearest.
  const half = sign | (exp << 10) | (mantissa >>> 13);
  return mantissa & 0x1000 ? half + 1 : half;
}

/** A lookup table from every 16-bit integer sample (0–65535) to its half float. */
let table: Uint16Array | null = null;

export function uint16ToHalf(samples: Uint16Array): Uint16Array {
  if (!table) {
    table = new Uint16Array(65536);
    for (let i = 0; i < 65536; i++) table[i] = toHalf(i / 65535);
  }
  const out = new Uint16Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = table[samples[i]];
  return out;
}

/** Back to a number, for tests. */
export function fromHalf(h: number): number {
  const sign = h & 0x8000 ? -1 : 1;
  const exp = (h >>> 10) & 0x1f;
  const mantissa = h & 0x3ff;
  if (exp === 0) return sign * Math.pow(2, -14) * (mantissa / 1024);
  if (exp === 31) return mantissa ? NaN : sign * Infinity;
  return sign * Math.pow(2, exp - 15) * (1 + mantissa / 1024);
}
