import { test } from '@playwright/test';

test('medición de rendimiento WebGL2 real con GPU física para 24 MP (6000x4000)', async ({ page }) => {
  test.setTimeout(90000);

  await page.goto('/');
  await page.waitForTimeout(1000);

  const metrics = await page.evaluate(async () => {
    // 1. Crear canvas offscreen para WebGL2
    const canvas = document.createElement('canvas');
    canvas.width = 2000;
    canvas.height = 2000;
    const gl = canvas.getContext('webgl2', {
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
      antialias: false,
    });

    if (!gl) {
      return { error: 'WebGL2 no soportado' };
    }

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = debugInfo
      ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER);
    const vendor = debugInfo
      ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
      : gl.getParameter(gl.VENDOR);

    // 2. Vertex & Fragment shaders (simulación del pipeline con halo dinámico)
    const vsSource = `#version 300 es
      in vec2 a_position;
      out vec2 v_texCoord;
      void main() {
        v_texCoord = (a_position + 1.0) * 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fsSource = `#version 300 es
      precision highp float;
      in vec2 v_texCoord;
      out vec4 fragColor;
      uniform sampler2D u_image;
      uniform float u_exposure;
      uniform float u_contrast;

      void main() {
        vec4 color = texture(u_image, v_texCoord);
        // Exposición lineal
        vec3 rgb = color.rgb * exp2(u_exposure);
        // Contraste sigmoidal
        rgb = (rgb - 0.5) * u_contrast + 0.5;
        fragColor = vec4(clamp(rgb, 0.0, 1.0), 1.0);
      }
    `;

    function createShader(glCtx: WebGL2RenderingContext, type: number, src: string) {
      const s = glCtx.createShader(type)!;
      glCtx.shaderSource(s, src);
      glCtx.compileShader(s);
      return s;
    }

    const program = gl.createProgram()!;
    gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vsSource));
    gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fsSource));
    gl.linkProgram(program);
    gl.useProgram(program);

    // Quad geometry
    const quadVao = gl.createVertexArray();
    gl.bindVertexArray(quadVao);
    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    // Textura fuente de tesela 2000x2000
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Inicializar textura con patrón sintético de 2000x2000
    const tilePixels = new Uint8Array(2000 * 2000 * 4);
    for (let i = 0; i < tilePixels.length; i += 4) {
      tilePixels[i] = (i * 13) & 255;
      tilePixels[i + 1] = (i * 29) & 255;
      tilePixels[i + 2] = (i * 7) & 255;
      tilePixels[i + 3] = 255;
    }
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2000, 2000, 0, gl.RGBA, gl.UNSIGNED_BYTE, tilePixels);

    // Uniforms
    const expLoc = gl.getUniformLocation(program, 'u_exposure');
    const conLoc = gl.getUniformLocation(program, 'u_contrast');
    gl.uniform1f(expLoc, 0.4);
    gl.uniform1f(conLoc, 1.15);

    // Buffer de destino para readPixels
    const readBuffer = new Uint8Array(2000 * 2000 * 4);

    // Warm-up run
    gl.viewport(0, 0, 2000, 2000);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.finish();
    gl.readPixels(0, 0, 2000, 2000, gl.RGBA, gl.UNSIGNED_BYTE, readBuffer);

    // Medición exacta de 6 teselas (6 x 2000x2000 = 24 Megapíxeles)
    // Desglose: Render WebGL vs readPixels GPU->CPU
    let totalRenderTime = 0;
    let totalReadPixelsTime = 0;

    for (let t = 0; t < 6; t++) {
      // 1. Tiempo de Render GPU con sincronización gl.finish()
      const tRenderStart = performance.now();
      gl.viewport(0, 0, 2000, 2000);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.finish(); // Sincronización bloqueante obligatoria para medir tiempo GPU real
      const tRenderEnd = performance.now();
      totalRenderTime += (tRenderEnd - tRenderStart);

      // 2. Tiempo de lectura de GPU a CPU (gl.readPixels)
      const tReadStart = performance.now();
      gl.readPixels(0, 0, 2000, 2000, gl.RGBA, gl.UNSIGNED_BYTE, readBuffer);
      const tReadEnd = performance.now();
      totalReadPixelsTime += (tReadEnd - tReadStart);
    }

    return {
      renderer,
      vendor,
      totalTiles: 6,
      megapixels: 24,
      gpuRenderTimeMs: totalRenderTime,
      gpuReadPixelsTimeMs: totalReadPixelsTime,
      totalGpuFrontendMs: totalRenderTime + totalReadPixelsTime,
    };
  });

  console.log('\n=======================================================');
  console.log('  MEDICIÓN REAL EN NAVEGADOR (CHROMIUM / WEBGL2 REAL)');
  console.log('=======================================================');
  console.log(`GPU Renderer:             ${metrics.renderer}`);
  console.log(`GPU Vendor:               ${metrics.vendor}`);
  console.log(`Foto evaluada:            24 Megapíxeles (6000 x 4000, 6 teselas de 2000x2000)`);
  console.log(`1. Renderizado WebGL GPU (con gl.finish):  ${metrics.gpuRenderTimeMs?.toFixed(2)} ms`);
  console.log(`2. Lectura GPU->CPU (gl.readPixels):       ${metrics.gpuReadPixelsTimeMs?.toFixed(2)} ms`);
  console.log(`Total Frontend GPU (Render + Read):        ${metrics.totalGpuFrontendMs?.toFixed(2)} ms`);
  console.log('=======================================================\n');
});
