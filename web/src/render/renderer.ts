import { STRENGTH, wheelOffset, type Vec3 } from "../edit/color";
import { buildLut, LUT_SIZE } from "../edit/lut";
import { BW_COLORS, SLIDERS, type EditSettings } from "../edit/settings";
import { FRAGMENT_SHADER, VERTEX_SHADER } from "./shaders";

/** Draws one image with the current settings into a canvas via WebGL2. */
export class Renderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private texture: WebGLTexture;
  private lutTexture: WebGLTexture;
  private lutFor: Pick<EditSettings, "levels" | "curves"> | null = null;
  private uniforms = new Map<string, WebGLUniformLocation | null>();

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2");
    if (!gl) throw new Error("This browser does not support WebGL2.");
    this.gl = gl;
    this.program = linkProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
    this.texture = createTexture(gl);
    this.lutTexture = createTexture(gl);
  }

  get maxTextureSize(): number {
    return this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE) as number;
  }

  setImage(source: TexImageSource, width: number, height: number): void {
    const { gl } = this;
    this.canvas.width = width;
    this.canvas.height = height;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  }

  render(settings: EditSettings, bypass: boolean): void {
    const { gl } = this;
    this.updateLut(settings);

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.uniform("u_image"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.lutTexture);
    gl.uniform1i(this.uniform("u_lut"), 1);
    gl.uniform1i(this.uniform("u_bypass"), bypass ? 1 : 0);

    for (const s of SLIDERS) {
      // Exposure goes to the shader in stops; percentage sliders as -1..1.
      const value = s.id === "exposure" ? settings[s.id] : settings[s.id] / 100;
      gl.uniform1f(this.uniform(`u_${s.id}`), value);
    }

    const bw = settings.blackWhite;
    gl.uniform1i(this.uniform("u_bwEnabled"), bw.enabled ? 1 : 0);
    gl.uniform1fv(this.uniform("u_bwSensitivity"), BW_COLORS.map((c) => bw.sensitivity[c] / 100));
    this.vec3("u_bwHighlightTone", wheelOffset(bw.highlightTone, STRENGTH.splitTone));
    this.vec3("u_bwShadowTone", wheelOffset(bw.shadowTone, STRENGTH.splitTone));

    const cb = settings.colorBalance;
    this.vec3("u_cbMaster", wheelOffset(cb.master, STRENGTH.master));
    this.vec3("u_cbShadows", wheelOffset(cb.shadows, STRENGTH.zone));
    this.vec3("u_cbMidtones", wheelOffset(cb.midtones, STRENGTH.zone));
    this.vec3("u_cbHighlights", wheelOffset(cb.highlights, STRENGTH.zone));
    const k = STRENGTH.lightness / 100;
    this.vec3("u_cbLightness", [cb.shadows.lightness * k, cb.midtones.lightness * k, cb.highlights.lightness * k]);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose(): void {
    this.gl.deleteTexture(this.texture);
    this.gl.deleteTexture(this.lutTexture);
    this.gl.deleteProgram(this.program);
  }

  /** Rebuilds the levels/curves LUT only when those settings changed. */
  private updateLut({ levels, curves }: EditSettings): void {
    if (this.lutFor?.levels === levels && this.lutFor.curves === curves) return;
    const { gl } = this;
    gl.bindTexture(gl.TEXTURE_2D, this.lutTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, LUT_SIZE, 1, 0, gl.RGBA, gl.FLOAT, buildLut(levels, curves));
    this.lutFor = { levels, curves };
  }

  private vec3(name: string, v: Vec3): void {
    this.gl.uniform3fv(this.uniform(name), v);
  }

  private uniform(name: string): WebGLUniformLocation | null {
    if (!this.uniforms.has(name)) {
      this.uniforms.set(name, this.gl.getUniformLocation(this.program, name));
    }
    return this.uniforms.get(name) ?? null;
  }
}

function createTexture(gl: WebGL2RenderingContext): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) throw new Error("Could not create a WebGL texture.");
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Could not create a WebGL shader.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader failed to compile: ${log}`);
  }
  return shader;
}

function linkProgram(gl: WebGL2RenderingContext, vertex: string, fragment: string): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error("Could not create a WebGL program.");
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertex);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragment);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Shader program failed to link: ${gl.getProgramInfoLog(program)}`);
  }
  return program;
}
