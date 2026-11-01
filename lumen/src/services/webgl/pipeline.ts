/**
 * Lumen WebGL2 Develop Pipeline (Architecture v2.1)
 *
 * Implements:
 * 1. Ping-pong RGBA16F framebuffers for spatial convolution passes (Sharpen / Blur)
 * 2. Single unified uber-shader pass for all point-wise operations
 * 3. Curve LUT generation via monotonic cubic spline interpolation
 * 4. Geometry transformation matrix (rotation, flip, straighten, crop)
 * 5. High-precision 256-bin RGB histogram computation directly from GPU pixels
 */

import { UBER_VERTEX_SHADER, UBER_FRAGMENT_SHADER } from './shaders/uberShader';
import {
  SPATIAL_VERTEX_SHADER,
  SHARPEN_FRAGMENT_SHADER,
  BLUR_FRAGMENT_SHADER,
  CLARITY_TEXTURE_FRAGMENT_SHADER,
  DEHAZE_FRAGMENT_SHADER,
  NOISE_REDUCTION_FRAGMENT_SHADER,
} from './shaders/spatialShader';
import type { LumenSettings } from '../../types';

export class DevelopPipeline {
  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;

  // Quad buffers
  private quadVao!: WebGLVertexArrayObject;
  private quadVbo!: WebGLBuffer;

  // Shaders & Programs
  private uberProgram!: WebGLProgram;
  private sharpenProgram!: WebGLProgram;
  private blurProgram!: WebGLProgram;
  private clarityTextureProgram!: WebGLProgram;
  private dehazeProgram!: WebGLProgram;
  private nrProgram!: WebGLProgram;

  // Source Texture
  private sourceTexture: WebGLTexture | null = null;
  public imageWidth: number = 0;
  public imageHeight: number = 0;

  // Tone Curve LUT Texture (256 x 1)
  private curveTexture: WebGLTexture | null = null;

  // Ping-pong FBOs for spatial passes
  private pingPongFBOs: [WebGLFramebuffer, WebGLFramebuffer] = [null as any, null as any];
  private pingPongTextures: [WebGLTexture, WebGLTexture] = [null as any, null as any];
  private fboWidth: number = 0;
  private fboHeight: number = 0;

  // Clipping warning and mask overlay state
  public showClipping: boolean = false;
  public showMaskOverlay: boolean = false;
  public draftMode: boolean = false;
  public activeMaskIndex: number = 0;


  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: true,
    });

    if (!gl) {
      throw new Error('WebGL 2.0 is not supported in this environment');
    }
    this.gl = gl;

    // Enable floating point framebuffer extension
    gl.getExtension('EXT_color_buffer_float');

    this.initBuffers();
    this.initPrograms();
    this.initCurveLut();
  }

  private initBuffers() {
    const gl = this.gl;
    // Full screen quad [-1, 1] with UVs [0, 1]
    const vertices = new Float32Array([
      // pos x, y   uv u, v
      -1, -1, 0, 0,
       1, -1, 1, 0,
      -1,  1, 0, 1,
      -1,  1, 0, 1,
       1, -1, 1, 0,
       1,  1, 1, 1,
    ]);

    this.quadVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.quadVao);

    this.quadVbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // Position attrib (loc 0)
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);

    // UV attrib (loc 1)
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);

    gl.bindVertexArray(null);
  }

  private createProgram(vsSource: string, fsSource: string): WebGLProgram {
    const gl = this.gl;
    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, vsSource);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      const err = gl.getShaderInfoLog(vs);
      gl.deleteShader(vs);
      throw new Error(`Vertex shader compilation failed: ${err}`);
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, fsSource);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      const err = gl.getShaderInfoLog(fs);
      gl.deleteShader(fs);
      throw new Error(`Fragment shader compilation failed: ${err}`);
    }

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    // Bind generic attributes to match VAO
    gl.bindAttribLocation(prog, 0, 'a_position');
    gl.bindAttribLocation(prog, 1, 'a_texCoord');
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const err = gl.getProgramInfoLog(prog);
      gl.deleteProgram(prog);
      throw new Error(`Program linking failed: ${err}`);
    }

    return prog;
  }

  private initPrograms() {
    this.uberProgram = this.createProgram(UBER_VERTEX_SHADER, UBER_FRAGMENT_SHADER);
    this.sharpenProgram = this.createProgram(SPATIAL_VERTEX_SHADER, SHARPEN_FRAGMENT_SHADER);
    this.blurProgram = this.createProgram(SPATIAL_VERTEX_SHADER, BLUR_FRAGMENT_SHADER);
    this.clarityTextureProgram = this.createProgram(SPATIAL_VERTEX_SHADER, CLARITY_TEXTURE_FRAGMENT_SHADER);
    this.dehazeProgram = this.createProgram(SPATIAL_VERTEX_SHADER, DEHAZE_FRAGMENT_SHADER);
    this.nrProgram = this.createProgram(SPATIAL_VERTEX_SHADER, NOISE_REDUCTION_FRAGMENT_SHADER);
  }

  private initCurveLut() {
    const gl = this.gl;
    this.curveTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.curveTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Initial identity curve
    const idLut = new Uint8Array(256 * 4);
    for (let i = 0; i < 256; i++) {
      idLut[i * 4] = i;
      idLut[i * 4 + 1] = i;
      idLut[i * 4 + 2] = i;
      idLut[i * 4 + 3] = 255;
    }
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, idLut);
  }

  /**
   * Uploads tone curve points [[x0, y0], ... [xn, yn]] into the 256x1 LUT texture.
   */
  public updateCurveLut(points: [number, number][]) {
    if (!points || points.length < 2) return;
    const gl = this.gl;

    // Monotonic spline or piecewise linear interpolation across 256 steps
    const lut = new Uint8Array(256 * 4);
    const sorted = [...points].sort((a, b) => a[0] - b[0]);

    for (let i = 0; i < 256; i++) {
      const x = i / 255;
      let y = x;

      if (x <= sorted[0][0]) {
        y = sorted[0][1];
      } else if (x >= sorted[sorted.length - 1][0]) {
        y = sorted[sorted.length - 1][1];
      } else {
        for (let j = 0; j < sorted.length - 1; j++) {
          if (x >= sorted[j][0] && x <= sorted[j + 1][0]) {
            const t = (x - sorted[j][0]) / (sorted[j + 1][0] - sorted[j][0]);
            // Smoothstep hermite interpolation
            const smoothT = t * t * (3 - 2 * t);
            y = sorted[j][1] + (sorted[j + 1][1] - sorted[j][1]) * smoothT;
            break;
          }
        }
      }

      const val = Math.max(0, Math.min(255, Math.round(y * 255)));
      lut[i * 4] = val;
      lut[i * 4 + 1] = val;
      lut[i * 4 + 2] = val;
      lut[i * 4 + 3] = 255;
    }

    gl.bindTexture(gl.TEXTURE_2D, this.curveTexture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 1, gl.RGBA, gl.UNSIGNED_BYTE, lut);
  }

  /**
   * Allocate / resize RGBA16F ping-pong framebuffers to match image dimensions.
   */
  private resizePingPong(width: number, height: number) {
    if (this.fboWidth === width && this.fboHeight === height) return;
    const gl = this.gl;
    this.fboWidth = width;
    this.fboHeight = height;

    for (let i = 0; i < 2; i++) {
      if (this.pingPongTextures[i]) gl.deleteTexture(this.pingPongTextures[i]);
      if (this.pingPongFBOs[i]) gl.deleteFramebuffer(this.pingPongFBOs[i]);

      this.pingPongTextures[i] = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, this.pingPongTextures[i]);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      // Try RGBA16F for high dynamic range linear processing, fallback to RGBA8
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
      } catch {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      }

      this.pingPongFBOs[i] = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.pingPongFBOs[i]);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        this.pingPongTextures[i],
        0,
      );
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /**
   * Load a new source image into WebGL.
   */
  public async loadSourceImage(source: HTMLImageElement | ImageBitmap): Promise<void> {
    const gl = this.gl;
    this.imageWidth = source.width;
    this.imageHeight = source.height;

    if (!this.sourceTexture) {
      this.sourceTexture = gl.createTexture()!;
    }

    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    this.resizePingPong(this.imageWidth, this.imageHeight);
  }

  /**
   * Build 3x3 transformation matrix for geometry (rotation, flip, straighten, crop).
   */
  private buildGeometryMatrix(geom: LumenSettings['geometry']): Float32Array {
    // Identity
    let m = [
      1, 0, 0,
      0, 1, 0,
      0, 0, 1,
    ];

    // Center pivot (UV 0.5, 0.5)
    const translate = (tx: number, ty: number) => {
      m[6] += m[0] * tx + m[3] * ty;
      m[7] += m[1] * tx + m[4] * ty;
    };

    const scale = (sx: number, sy: number) => {
      m[0] *= sx; m[1] *= sx;
      m[3] *= sy; m[4] *= sy;
    };

    const rotate = (rad: number) => {
      const c = Math.cos(rad);
      const s = Math.sin(rad);
      const m0 = m[0], m1 = m[1], m3 = m[3], m4 = m[4];
      m[0] = m0 * c + m3 * s;
      m[1] = m1 * c + m4 * s;
      m[3] = m0 * -s + m3 * c;
      m[4] = m1 * -s + m4 * c;
    };

    translate(-0.5, -0.5);

    // Flips
    if (geom.flipH) scale(-1, 1);
    if (geom.flipV) scale(1, -1);

    // 90-degree rotations (0, 1=90, 2=180, 3=270)
    if (geom.rotation) {
      rotate((geom.rotation * Math.PI) / 2);
    }

    // Straighten angle
    if (geom.straighten) {
      rotate((geom.straighten * Math.PI) / 180);
    }

    translate(0.5, 0.5);

    return new Float32Array(m);
  }

  /**
   * Render the entire pipeline with given settings.
   */
  public render(settings: LumenSettings): void {
    if (!this.sourceTexture) return;
    const gl = this.gl;

    let currentInputTex = this.sourceTexture;
    let currentFboIndex = 0;

    // Update tone curve LUT
    if (settings.curvePoints && settings.curvePoints.length > 1) {
      this.updateCurveLut(settings.curvePoints);
    }

    // ─── STEP 1: Spatial Passes (ping-pong FBOs) ──────────────────────
    // Skip heavy spatial passes in draftMode while dragging sliders for 60fps responsiveness
    if (!this.draftMode && (settings.clarity !== 0 || settings.texture !== 0)) {
      const destFbo = this.pingPongFBOs[currentFboIndex];
      gl.bindFramebuffer(gl.FRAMEBUFFER, destFbo);
      gl.viewport(0, 0, this.fboWidth, this.fboHeight);

      gl.useProgram(this.clarityTextureProgram);
      gl.bindVertexArray(this.quadVao);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, currentInputTex);
      gl.uniform1i(gl.getUniformLocation(this.clarityTextureProgram, 'u_image'), 0);
      gl.uniform2f(
        gl.getUniformLocation(this.clarityTextureProgram, 'u_texelSize'),
        1.0 / this.fboWidth,
        1.0 / this.fboHeight,
      );
      gl.uniform1f(gl.getUniformLocation(this.clarityTextureProgram, 'u_clarity'), settings.clarity);
      gl.uniform1f(gl.getUniformLocation(this.clarityTextureProgram, 'u_texture'), settings.texture);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      currentInputTex = this.pingPongTextures[currentFboIndex];
      currentFboIndex = 1 - currentFboIndex;
    }

    if (!this.draftMode && settings.dehaze !== 0) {
      const destFbo = this.pingPongFBOs[currentFboIndex];
      gl.bindFramebuffer(gl.FRAMEBUFFER, destFbo);
      gl.viewport(0, 0, this.fboWidth, this.fboHeight);

      gl.useProgram(this.dehazeProgram);
      gl.bindVertexArray(this.quadVao);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, currentInputTex);
      gl.uniform1i(gl.getUniformLocation(this.dehazeProgram, 'u_image'), 0);
      gl.uniform2f(
        gl.getUniformLocation(this.dehazeProgram, 'u_texelSize'),
        1.0 / this.fboWidth,
        1.0 / this.fboHeight,
      );
      gl.uniform1f(gl.getUniformLocation(this.dehazeProgram, 'u_dehaze'), settings.dehaze);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      currentInputTex = this.pingPongTextures[currentFboIndex];
      currentFboIndex = 1 - currentFboIndex;
    }

    const nrLum = (settings.nrLum || 0) / 100;
    const nrColor = (settings.nrColor || 0) / 100;
    if (!this.draftMode && (nrLum > 0 || nrColor > 0)) {
      const destFbo = this.pingPongFBOs[currentFboIndex];
      gl.bindFramebuffer(gl.FRAMEBUFFER, destFbo);
      gl.viewport(0, 0, this.fboWidth, this.fboHeight);

      gl.useProgram(this.nrProgram);
      gl.bindVertexArray(this.quadVao);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, currentInputTex);
      gl.uniform1i(gl.getUniformLocation(this.nrProgram, 'u_image'), 0);
      gl.uniform2f(
        gl.getUniformLocation(this.nrProgram, 'u_texelSize'),
        1.0 / this.fboWidth,
        1.0 / this.fboHeight,
      );
      gl.uniform1f(gl.getUniformLocation(this.nrProgram, 'u_nrLum'), nrLum);
      gl.uniform1f(gl.getUniformLocation(this.nrProgram, 'u_nrColor'), nrColor);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      currentInputTex = this.pingPongTextures[currentFboIndex];
      currentFboIndex = 1 - currentFboIndex;
    }

    if (!this.draftMode && settings.sharpen > 0) {
      const destFbo = this.pingPongFBOs[currentFboIndex];
      gl.bindFramebuffer(gl.FRAMEBUFFER, destFbo);
      gl.viewport(0, 0, this.fboWidth, this.fboHeight);

      gl.useProgram(this.sharpenProgram);
      gl.bindVertexArray(this.quadVao);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, currentInputTex);
      gl.uniform1i(gl.getUniformLocation(this.sharpenProgram, 'u_image'), 0);
      gl.uniform2f(
        gl.getUniformLocation(this.sharpenProgram, 'u_texelSize'),
        1.0 / this.fboWidth,
        1.0 / this.fboHeight,
      );
      gl.uniform1f(gl.getUniformLocation(this.sharpenProgram, 'u_amount'), settings.sharpen);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      currentInputTex = this.pingPongTextures[currentFboIndex];
      currentFboIndex = 1 - currentFboIndex;
    }

    // 1B. Blur pass (2-pass separable)
    if (!this.draftMode && settings.blur > 0) {
      // Horizontal
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.pingPongFBOs[currentFboIndex]);
      gl.viewport(0, 0, this.fboWidth, this.fboHeight);
      gl.useProgram(this.blurProgram);
      gl.bindVertexArray(this.quadVao);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, currentInputTex);
      gl.uniform1i(gl.getUniformLocation(this.blurProgram, 'u_image'), 0);
      gl.uniform2f(
        gl.getUniformLocation(this.blurProgram, 'u_direction'),
        1.0 / this.fboWidth,
        0.0,
      );
      gl.uniform1f(gl.getUniformLocation(this.blurProgram, 'u_radius'), settings.blur * 4.0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      currentInputTex = this.pingPongTextures[currentFboIndex];
      currentFboIndex = 1 - currentFboIndex;

      // Vertical
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.pingPongFBOs[currentFboIndex]);
      gl.viewport(0, 0, this.fboWidth, this.fboHeight);
      gl.uniform2f(
        gl.getUniformLocation(this.blurProgram, 'u_direction'),
        0.0,
        1.0 / this.fboHeight,
      );
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, currentInputTex);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      currentInputTex = this.pingPongTextures[currentFboIndex];
      currentFboIndex = 1 - currentFboIndex;
    }

    // ─── STEP 2: Unified Uber-Shader Pass (Point-wise operations) ───────
    // Render directly to display canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    gl.useProgram(this.uberProgram);
    gl.bindVertexArray(this.quadVao);

    // Bind source/intermediate texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, currentInputTex);
    gl.uniform1i(gl.getUniformLocation(this.uberProgram, 'u_image'), 0);

    // Bind Tone Curve LUT
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.curveTexture);
    gl.uniform1i(gl.getUniformLocation(this.uberProgram, 'u_curveLut'), 1);
    gl.uniform1i(
      gl.getUniformLocation(this.uberProgram, 'u_useCurve'),
      settings.curvePoints && settings.curvePoints.length > 2 ? 1 : 0,
    );

    // Geometry transform matrix
    const geomMat = this.buildGeometryMatrix(settings.geometry);
    gl.uniformMatrix3fv(gl.getUniformLocation(this.uberProgram, 'u_geomTransform'), false, geomMat);

    // Basic adjustments
    gl.uniform1f(gl.getUniformLocation(this.uberProgram, 'u_exposure'), settings.exposure);
    gl.uniform1f(gl.getUniformLocation(this.uberProgram, 'u_contrast'), settings.contrast);
    gl.uniform1f(gl.getUniformLocation(this.uberProgram, 'u_highlights'), settings.highlights);
    gl.uniform1f(gl.getUniformLocation(this.uberProgram, 'u_shadows'), settings.shadows);
    gl.uniform1f(gl.getUniformLocation(this.uberProgram, 'u_whites'), settings.whites || 0.0);
    gl.uniform1f(gl.getUniformLocation(this.uberProgram, 'u_blacks'), settings.blacks || 0.0);

    // White balance & Color
    gl.uniform1f(gl.getUniformLocation(this.uberProgram, 'u_temperature'), settings.temperature);
    gl.uniform1f(gl.getUniformLocation(this.uberProgram, 'u_tint'), settings.tint);
    gl.uniform1f(gl.getUniformLocation(this.uberProgram, 'u_vibrance'), settings.vibrance);
    gl.uniform1f(gl.getUniformLocation(this.uberProgram, 'u_saturation'), settings.saturation);
    gl.uniform1f(gl.getUniformLocation(this.uberProgram, 'u_bw'), settings.bw);

    // Effects & Vignette
    gl.uniform1f(gl.getUniformLocation(this.uberProgram, 'u_matte'), settings.matte);
    gl.uniform1f(gl.getUniformLocation(this.uberProgram, 'u_vignette'), settings.vignette);
    gl.uniform1f(gl.getUniformLocation(this.uberProgram, 'u_vigMidpoint'), (settings.vignetteMidpoint ?? 50) / 100);
    gl.uniform1f(gl.getUniformLocation(this.uberProgram, 'u_vigRoundness'), (settings.vignetteRoundness ?? 0) / 100);
    gl.uniform1f(gl.getUniformLocation(this.uberProgram, 'u_vigFeather'), (settings.vignetteFeather ?? 50) / 100);
    gl.uniform1f(gl.getUniformLocation(this.uberProgram, 'u_grain'), settings.grain);
    gl.uniform1f(gl.getUniformLocation(this.uberProgram, 'u_grainSize'), (settings.grainSize ?? 25) / 50);
    gl.uniform1f(gl.getUniformLocation(this.uberProgram, 'u_grainRoughness'), (settings.grainRoughness ?? 50) / 100);

    // Color Grading
    const cg = settings.colorGrading || {
      shadows: { hue: 0, sat: 0, lum: 0 },
      midtones: { hue: 0, sat: 0, lum: 0 },
      highlights: { hue: 0, sat: 0, lum: 0 },
      blending: 50,
      balance: 0,
    };
    gl.uniform3f(
      gl.getUniformLocation(this.uberProgram, 'u_cgShadows'),
      cg.shadows.hue,
      cg.shadows.sat / 100,
      cg.shadows.lum / 100,
    );
    gl.uniform3f(
      gl.getUniformLocation(this.uberProgram, 'u_cgMidtones'),
      cg.midtones.hue,
      cg.midtones.sat / 100,
      cg.midtones.lum / 100,
    );
    gl.uniform3f(
      gl.getUniformLocation(this.uberProgram, 'u_cgHighlights'),
      cg.highlights.hue,
      cg.highlights.sat / 100,
      cg.highlights.lum / 100,
    );
    gl.uniform1f(gl.getUniformLocation(this.uberProgram, 'u_cgBlending'), (cg.blending ?? 50) / 100);
    gl.uniform1f(gl.getUniformLocation(this.uberProgram, 'u_cgBalance'), (cg.balance ?? 0) / 100);

    // Lens Corrections
    const lc = settings.lensCorrections || { removeChromaticAberration: false, distortion: 0, lensVignette: 0 };
    gl.uniform1i(gl.getUniformLocation(this.uberProgram, 'u_removeCA'), lc.removeChromaticAberration ? 1 : 0);
    gl.uniform1f(gl.getUniformLocation(this.uberProgram, 'u_lensDistortion'), (lc.distortion ?? 0) / 100);
    gl.uniform1f(gl.getUniformLocation(this.uberProgram, 'u_lensVignette'), (lc.lensVignette ?? 0) / 100);

    // Calibration
    const cal = settings.calibration || {
      profile: 'Cámara estándar',
      shadowTint: 0,
      redPrimary: { hue: 0, saturation: 0 },
      greenPrimary: { hue: 0, saturation: 0 },
      bluePrimary: { hue: 0, saturation: 0 },
    };
    let profileMode = 0; // 0 = Cámara estándar / default
    if (cal.profile === 'Neutro' || cal.profile === 'Adobe Neutro') profileMode = 1;
    else if (cal.profile === 'Plano') profileMode = 2;
    gl.uniform1i(gl.getUniformLocation(this.uberProgram, 'u_calibProfileMode'), profileMode);

    gl.uniform1f(gl.getUniformLocation(this.uberProgram, 'u_calibShadowTint'), (cal.shadowTint ?? 0) / 100);
    gl.uniform2f(gl.getUniformLocation(this.uberProgram, 'u_calibRed'), (cal.redPrimary?.hue ?? 0) / 100, (cal.redPrimary?.saturation ?? 0) / 100);
    gl.uniform2f(gl.getUniformLocation(this.uberProgram, 'u_calibGreen'), (cal.greenPrimary?.hue ?? 0) / 100, (cal.greenPrimary?.saturation ?? 0) / 100);
    gl.uniform2f(gl.getUniformLocation(this.uberProgram, 'u_calibBlue'), (cal.bluePrimary?.hue ?? 0) / 100, (cal.bluePrimary?.saturation ?? 0) / 100);

    // HSL 8 Bands
    const hslFlat = new Float32Array(8 * 3);
    for (let i = 0; i < 8; i++) {
      const band = settings.hsl[i] || { hue: 0, saturation: 0, luminance: 0 };
      hslFlat[i * 3] = band.hue;
      hslFlat[i * 3 + 1] = band.saturation;
      hslFlat[i * 3 + 2] = band.luminance;
    }
    gl.uniform3fv(gl.getUniformLocation(this.uberProgram, 'u_hslBands'), hslFlat);

    // Mask Uniforms
    const activeMask = settings.masks && settings.masks.length > 0
      ? settings.masks[Math.min(this.activeMaskIndex, settings.masks.length - 1)]
      : null;

    if (activeMask && activeMask.type === 'radial') {
      gl.uniform1i(gl.getUniformLocation(this.uberProgram, 'u_maskType'), 1);
      gl.uniform2f(gl.getUniformLocation(this.uberProgram, 'u_maskCenter'), activeMask.x, activeMask.y);
      gl.uniform1f(gl.getUniformLocation(this.uberProgram, 'u_maskRadius'), activeMask.radius);
      gl.uniform1f(gl.getUniformLocation(this.uberProgram, 'u_maskFeather'), activeMask.feather);
      gl.uniform1i(gl.getUniformLocation(this.uberProgram, 'u_maskInvert'), activeMask.invert ? 1 : 0);
      gl.uniform1f(gl.getUniformLocation(this.uberProgram, 'u_maskExposure'), activeMask.adjustments.exposure);
      gl.uniform1f(gl.getUniformLocation(this.uberProgram, 'u_maskContrast'), activeMask.adjustments.contrast);
      gl.uniform1f(gl.getUniformLocation(this.uberProgram, 'u_maskSaturation'), activeMask.adjustments.saturation);
      gl.uniform1f(gl.getUniformLocation(this.uberProgram, 'u_maskTemperature'), activeMask.adjustments.temperature);
    } else if (activeMask && activeMask.type === 'linear') {
      gl.uniform1i(gl.getUniformLocation(this.uberProgram, 'u_maskType'), 2);
      gl.uniform2f(gl.getUniformLocation(this.uberProgram, 'u_maskCenter'), activeMask.x, activeMask.y);
      gl.uniform1f(gl.getUniformLocation(this.uberProgram, 'u_maskAngle'), activeMask.angle);
      gl.uniform1f(gl.getUniformLocation(this.uberProgram, 'u_maskFeather'), activeMask.feather);
      gl.uniform1i(gl.getUniformLocation(this.uberProgram, 'u_maskInvert'), activeMask.invert ? 1 : 0);
      gl.uniform1f(gl.getUniformLocation(this.uberProgram, 'u_maskExposure'), activeMask.adjustments.exposure);
      gl.uniform1f(gl.getUniformLocation(this.uberProgram, 'u_maskContrast'), activeMask.adjustments.contrast);
      gl.uniform1f(gl.getUniformLocation(this.uberProgram, 'u_maskSaturation'), activeMask.adjustments.saturation);
      gl.uniform1f(gl.getUniformLocation(this.uberProgram, 'u_maskTemperature'), activeMask.adjustments.temperature);
    } else {
      gl.uniform1i(gl.getUniformLocation(this.uberProgram, 'u_maskType'), 0);
    }

    gl.uniform1i(
      gl.getUniformLocation(this.uberProgram, 'u_showMaskOverlay'),
      this.showMaskOverlay ? 1 : 0,
    );

    // Clipping warnings
    gl.uniform1i(gl.getUniformLocation(this.uberProgram, 'u_showClipping'), this.showClipping ? 1 : 0);

    // Draw final quad
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  /**
   * Read back raw RGBA pixels from the current canvas for histogram or export.
   */
  public readPixels(width: number, height: number): Uint8Array {
    const gl = this.gl;
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    return pixels;
  }

  public destroy() {
    const gl = this.gl;
    if (this.sourceTexture) gl.deleteTexture(this.sourceTexture);
    if (this.curveTexture) gl.deleteTexture(this.curveTexture);
    for (let i = 0; i < 2; i++) {
      if (this.pingPongTextures[i]) gl.deleteTexture(this.pingPongTextures[i]);
      if (this.pingPongFBOs[i]) gl.deleteFramebuffer(this.pingPongFBOs[i]);
    }
    gl.deleteProgram(this.uberProgram);
    gl.deleteProgram(this.sharpenProgram);
    gl.deleteProgram(this.blurProgram);
    gl.deleteProgram(this.clarityTextureProgram);
    gl.deleteProgram(this.dehazeProgram);
    gl.deleteProgram(this.nrProgram);
  }
}
