// GLSL for the live preview. Order of operations:
//   linear light: white balance, exposure
//   display (sRGB) space: highlights/shadows/whites/blacks, brightness,
//   contrast, saturation
// These curves are our own approximations; calibrating them against
// Capture One renders is a later task (see SPEC.md, Risks).

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

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

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

  c = mix(vec3(dot(c, LUMA)), c, 1.0 + u_saturation);

  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;
