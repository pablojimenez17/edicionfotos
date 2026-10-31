/**
 * Spatial Operations Shaders (GLSL ES 3.00)
 *
 * Implements neighborhood/convolution operations:
 * - Unsharp Mask (Sharpen) with radius, amount and threshold
 * - 2-pass Separable Gaussian Blur (Horizontal / Vertical)
 * Rendered into RGBA16F ping-pong framebuffers before the uber-shader.
 */

export const SPATIAL_VERTEX_SHADER = `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;

out vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;

// Sharpening fragment shader (3x3 Laplacian / Unsharp Mask)
export const SHARPEN_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_image;
uniform vec2 u_texelSize; // 1.0 / vec2(width, height)
uniform float u_amount;   // 0.0 .. 2.0

void main() {
  vec4 center = texture(u_image, v_texCoord);
  if (u_amount <= 0.0) {
    fragColor = center;
    return;
  }

  // Sample 4 cardinal neighbors
  vec4 top    = texture(u_image, v_texCoord + vec2(0.0, u_texelSize.y));
  vec4 bottom = texture(u_image, v_texCoord - vec2(0.0, u_texelSize.y));
  vec4 left   = texture(u_image, v_texCoord - vec2(u_texelSize.x, 0.0));
  vec4 right  = texture(u_image, v_texCoord + vec2(u_texelSize.x, 0.0));

  // High-pass signal
  vec4 highPass = center * 4.0 - (top + bottom + left + right);

  // Blend high-pass into original
  vec4 sharpened = center + highPass * (u_amount * 0.5);
  fragColor = clamp(sharpened, 0.0, 1.0);
}
`;

// Gaussian blur pass (separable 1D blur, horizontal or vertical)
export const BLUR_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_image;
uniform vec2 u_direction; // (1.0, 0.0) or (0.0, 1.0) * texelSize
uniform float u_radius;    // Blur radius

void main() {
  if (u_radius <= 0.0) {
    fragColor = texture(u_image, v_texCoord);
    return;
  }

  vec4 sum = vec4(0.0);
  // 9-tap Gaussian weights
  float weights[5] = float[5](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);

  sum += texture(u_image, v_texCoord) * weights[0];

  for (int i = 1; i < 5; i++) {
    float offset = float(i) * u_radius;
    sum += texture(u_image, v_texCoord + u_direction * offset) * weights[i];
    sum += texture(u_image, v_texCoord - u_direction * offset) * weights[i];
  }

  fragColor = sum;
}
`;

// Clarity & Texture spatial shader
// Texture acts on high spatial frequencies; Clarity acts on medium spatial frequencies (midtones)
export const CLARITY_TEXTURE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_image;
uniform vec2 u_texelSize;
uniform float u_clarity; // -1.0 .. 1.0
uniform float u_texture; // -1.0 .. 1.0

void main() {
  vec4 center = texture(u_image, v_texCoord);
  if (u_clarity == 0.0 && u_texture == 0.0) {
    fragColor = center;
    return;
  }

  // Sample fine neighborhood for texture (1 texel radius)
  vec4 tFine = (
    texture(u_image, v_texCoord + vec2(u_texelSize.x, 0.0)) +
    texture(u_image, v_texCoord - vec2(u_texelSize.x, 0.0)) +
    texture(u_image, v_texCoord + vec2(0.0, u_texelSize.y)) +
    texture(u_image, v_texCoord - vec2(0.0, u_texelSize.y))
  ) * 0.25;

  // Sample broader neighborhood for clarity (3 texels radius)
  vec4 tCoarse = (
    texture(u_image, v_texCoord + vec2(u_texelSize.x * 3.0, 0.0)) +
    texture(u_image, v_texCoord - vec2(u_texelSize.x * 3.0, 0.0)) +
    texture(u_image, v_texCoord + vec2(0.0, u_texelSize.y * 3.0)) +
    texture(u_image, v_texCoord - vec2(0.0, u_texelSize.y * 3.0))
  ) * 0.25;

  vec4 highFreq = center - tFine;
  vec4 midFreq = tFine - tCoarse;

  // Midtone weight for clarity to protect extremes
  float lum = dot(center.rgb, vec3(0.2126, 0.7152, 0.0722));
  float midtoneMask = 1.0 - 4.0 * pow(lum - 0.5, 2.0);
  midtoneMask = clamp(midtoneMask, 0.0, 1.0);

  vec4 result = center + highFreq * (u_texture * 0.7) + midFreq * (u_clarity * 0.6 * midtoneMask);
  fragColor = clamp(result, 0.0, 1.0);
}
`;

// Dehaze spatial shader (Dark Channel Prior transmission estimation)
export const DEHAZE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_image;
uniform vec2 u_texelSize;
uniform float u_dehaze; // -1.0 .. 1.0

void main() {
  vec4 center = texture(u_image, v_texCoord);
  if (u_dehaze == 0.0) {
    fragColor = center;
    return;
  }

  // Dark channel estimate over a 5-tap cross
  float d0 = min(center.r, min(center.g, center.b));
  float d1 = min(texture(u_image, v_texCoord + vec2(u_texelSize.x * 2.0, 0.0)).r,
             min(texture(u_image, v_texCoord + vec2(u_texelSize.x * 2.0, 0.0)).g,
                 texture(u_image, v_texCoord + vec2(u_texelSize.x * 2.0, 0.0)).b));
  float d2 = min(texture(u_image, v_texCoord - vec2(u_texelSize.x * 2.0, 0.0)).r,
             min(texture(u_image, v_texCoord - vec2(u_texelSize.x * 2.0, 0.0)).g,
                 texture(u_image, v_texCoord - vec2(u_texelSize.x * 2.0, 0.0)).b));
  float d3 = min(texture(u_image, v_texCoord + vec2(0.0, u_texelSize.y * 2.0)).r,
             min(texture(u_image, v_texCoord + vec2(0.0, u_texelSize.y * 2.0)).g,
                 texture(u_image, v_texCoord + vec2(0.0, u_texelSize.y * 2.0)).b));
  float d4 = min(texture(u_image, v_texCoord - vec2(0.0, u_texelSize.y * 2.0)).r,
             min(texture(u_image, v_texCoord - vec2(0.0, u_texelSize.y * 2.0)).g,
                 texture(u_image, v_texCoord - vec2(0.0, u_texelSize.y * 2.0)).b));
  float localDark = min(d0, min(min(d1, d2), min(d3, d4)));

  // Atmospheric light A assumed near 0.95
  float A = 0.95;
  float transmission = clamp(1.0 - 0.9 * (localDark / A), 0.1, 1.0);

  // Dehaze positive removes haze, negative adds atmospheric fog
  float t = mix(1.0, transmission, u_dehaze);
  vec3 restored = (center.rgb - vec3(A * (1.0 - t))) / max(t, 0.1);

  // Preserve luminance & restore subtle saturation
  float origLum = dot(center.rgb, vec3(0.2126, 0.7152, 0.0722));
  float newLum = dot(restored, vec3(0.2126, 0.7152, 0.0722));
  vec3 res = mix(center.rgb, restored, abs(u_dehaze));
  fragColor = vec4(clamp(res, 0.0, 1.0), center.a);
}
`;

// Bilateral Edge-Preserving Noise Reduction (Luminance & Chrominance)
export const NOISE_REDUCTION_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_image;
uniform vec2 u_texelSize;
uniform float u_nrLum;   // 0.0 .. 1.0
uniform float u_nrColor; // 0.0 .. 1.0

void main() {
  vec4 center = texture(u_image, v_texCoord);
  if (u_nrLum <= 0.0 && u_nrColor <= 0.0) {
    fragColor = center;
    return;
  }

  vec3 sumColor = vec3(0.0);
  float sumWeight = 0.0;
  float centerLum = dot(center.rgb, vec3(0.2126, 0.7152, 0.0722));
  float sigmaLum = max(0.02, (1.0 - u_nrLum * 0.8) * 0.3);

  // 9-tap 3x3 kernel with photometric distance weighting
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      vec2 offset = vec2(float(x), float(y)) * u_texelSize;
      vec4 neighbor = texture(u_image, v_texCoord + offset);
      float nLum = dot(neighbor.rgb, vec3(0.2126, 0.7152, 0.0722));

      // Spatial distance weight
      float spatialDist = float(x * x + y * y);
      float wSpatial = exp(-spatialDist * 0.5);

      // Color/Luminance distance weight (bilateral)
      float lumDiff = abs(nLum - centerLum);
      float wRange = exp(-(lumDiff * lumDiff) / (2.0 * sigmaLum * sigmaLum));

      float w = wSpatial * wRange;
      sumColor += neighbor.rgb * w;
      sumWeight += w;
    }
  }

  vec3 smoothed = sumColor / max(sumWeight, 0.0001);

  // Luminance NR blends smoothed luminance while preserving high-contrast edges
  float smoothedLum = dot(smoothed, vec3(0.2126, 0.7152, 0.0722));
  vec3 lumNR = center.rgb + vec3((smoothedLum - centerLum) * u_nrLum);

  // Color NR smooths out color noise (chrominance)
  vec3 colorNR = mix(lumNR, smoothed, u_nrColor * 0.75);

  fragColor = vec4(clamp(colorNR, 0.0, 1.0), center.a);
}
`;
