// GLSL for the live preview. Order of operations:
//   linear light: white balance, exposure
//   display (sRGB) space: highlights/shadows/whites/blacks, brightness,
//   contrast, saturation, levels + curves (via LUT), luma curve,
//   black & white (with split toning), color balance
// These curves are our own approximations; calibrating them against
// Capture One renders is a later task (see SPEC.md, Risks).

import { LUT_SIZE } from "../edit/lut";

export const VERTEX_SHADER = `#version 300 es
out vec2 v_uv;
void main() {
  // One triangle that covers the whole viewport; no vertex buffers needed.
  vec2 pos = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0);
  v_uv = pos * 0.5 + 0.5;
  gl_Position = vec4(pos, 0.0, 1.0);
}
`;

export const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_image;
uniform bool u_bypass;

uniform float u_exposure;    // stops
// The rest are normalized to -1..1.
uniform float u_temperature;
uniform float u_tint;
uniform float u_contrast;
uniform float u_brightness;
uniform float u_saturation;
uniform float u_highlights;
uniform float u_shadows;
uniform float u_whites;
uniform float u_blacks;

// Levels + curves. RGB = per-channel mapping, A = luma curve.
uniform sampler2D u_lut;

// Black & white. Sensitivities are -1..1 for red, yellow, green, cyan,
// blue, magenta; tones are color offsets (see color.ts wheelOffset).
uniform bool u_bwEnabled;
uniform float u_bwSensitivity[6];
uniform vec3 u_bwHighlightTone;
uniform vec3 u_bwShadowTone;

// Color balance: color offsets per zone, plus lightness per zone
// (x = shadows, y = midtones, z = highlights).
uniform vec3 u_cbMaster;
uniform vec3 u_cbShadows;
uniform vec3 u_cbMidtones;
uniform vec3 u_cbHighlights;
uniform vec3 u_cbLightness;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
const float LUT_SIZE = ${LUT_SIZE.toFixed(1)};

vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}

vec3 linearToSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

float toneLuma(float l) {
  // Each mask is zero at the ends it should not touch. Shadows peaks at
  // l = 0.2 and highlights at l = 0.8 (12.2 normalizes the peak to 1), so
  // midtones move far less than with a symmetric mask.
  l += u_shadows    * 0.35 * 12.2 * l * pow(1.0 - l, 4.0);
  l += u_highlights * 0.35 * 12.2 * pow(l, 4.0) * (1.0 - l);
  l += u_whites     * 0.25 * pow(l, 4.0);
  l += u_blacks     * 0.15 * pow(1.0 - l, 4.0);
  return l;
}

vec4 lut(float x) {
  // Sample texel centers so 0 and 1 map exactly to the first and last entry.
  return texture(u_lut, vec2((x * (LUT_SIZE - 1.0) + 0.5) / LUT_SIZE, 0.5));
}

// Hue on 0..6: 0 red, 1 yellow, 2 green, 3 cyan, 4 blue, 5 magenta.
float hue6(vec3 c) {
  float mx = max(c.r, max(c.g, c.b));
  float d = mx - min(c.r, min(c.g, c.b));
  if (d <= 0.0) return 0.0;
  float h;
  if (mx == c.r) h = mod((c.g - c.b) / d, 6.0);
  else if (mx == c.g) h = (c.b - c.r) / d + 2.0;
  else h = (c.r - c.g) / d + 4.0;
  return h;
}

// Weights for shadows, midtones, highlights; they always sum to 1.
vec3 zones(float l) {
  return vec3((1.0 - l) * (1.0 - l), 2.0 * l * (1.0 - l), l * l);
}

void main() {
  vec3 c = texture(u_image, v_uv).rgb;
  if (u_bypass) {
    outColor = vec4(c, 1.0);
    return;
  }

  // Linear light.
  c = srgbToLinear(c);
  vec3 gains = vec3(1.0 + 0.3 * u_temperature, 1.0 - 0.3 * u_tint, 1.0 - 0.3 * u_temperature);
  c *= gains / dot(gains, LUMA);
  c *= exp2(u_exposure);
  c = linearToSrgb(clamp(c, 0.0, 1.0));

  // Display space.
  float l = dot(c, LUMA);
  c = clamp(c + (toneLuma(l) - l), 0.0, 1.0);

  c = pow(c, vec3(exp2(-0.8 * u_brightness)));

  if (u_contrast >= 0.0) {
    c = mix(c, c * c * (3.0 - 2.0 * c), u_contrast);
  } else {
    c = mix(c, 0.5 + (c - 0.5) * 0.5, -u_contrast);
  }

  c = clamp(mix(vec3(dot(c, LUMA)), c, 1.0 + u_saturation), 0.0, 1.0);

  // Levels and curves.
  c = vec3(lut(c.r).r, lut(c.g).g, lut(c.b).b);
  l = dot(c, LUMA);
  c = clamp(c + (lut(l).a - l), 0.0, 1.0);

  // Black & white: gray from luma, brightened or darkened by how much of
  // each sensitivity color the pixel holds.
  if (u_bwEnabled) {
    float chroma = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
    float h = hue6(c);
    float adjust = 0.0;
    for (int i = 0; i < 6; i++) {
      float d = abs(h - float(i));
      d = min(d, 6.0 - d);
      adjust += u_bwSensitivity[i] * max(0.0, 1.0 - d);
    }
    float g = clamp(dot(c, LUMA) * (1.0 + adjust * chroma), 0.0, 1.0);
    c = vec3(g) + u_bwHighlightTone * g * g + u_bwShadowTone * (1.0 - g) * (1.0 - g);
    c = clamp(c, 0.0, 1.0);
  }

  // Color balance.
  vec3 w = zones(dot(c, LUMA));
  c += u_cbMaster + u_cbShadows * w.x + u_cbMidtones * w.y + u_cbHighlights * w.z + dot(u_cbLightness, w);

  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;
