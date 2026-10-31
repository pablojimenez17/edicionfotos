/**
 * Lumen Uber-Shader (GLSL ES 3.00)
 *
 * Implements all point-wise operations in a single fragment shader pass:
 * - Linear-light transfer
 * - Exposure, Contrast, Highlights, Shadows, Whites, Blacks
 * - White Balance (Temperature & Tint)
 * - Tone Curve (spline / LUT evaluation)
 * - HSL (8 color bands: Hue, Saturation, Luminance)
 * - Vibrance, Global Saturation, Black & White conversion
 * - Matte (shadows lift)
 * - Masks (radial, linear, and texture-based brush masks in normalized coords)
 * - Vignette (using global image coords)
 * - Film Grain (using global image coords and procedural hash noise)
 * - Highlight & Shadow clipping detection
 */

export const UBER_VERTEX_SHADER = `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;

out vec2 v_texCoord;
out vec2 v_globalCoord; // Normalized global image coords for vignette & grain

uniform mat3 u_geomTransform; // Geometry transformation matrix (rotation, flip, straighten, crop)

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  
  // Transform UV based on geometry
  vec3 transformedUV = u_geomTransform * vec3(a_texCoord, 1.0);
  v_texCoord = transformedUV.xy;
  v_globalCoord = a_texCoord; // Preserves uncropped global coordinates
}
`;

export const UBER_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_texCoord;
in vec2 v_globalCoord;

out vec4 fragColor;

// Source image texture (output of spatial passes)
uniform sampler2D u_image;

// 1D Tone Curve LUT texture (256x1 RGBA float)
uniform sampler2D u_curveLut;
uniform bool u_useCurve;

// Mask textures (up to 4 active masks combined or separate)
uniform sampler2D u_maskTexture;
uniform bool u_hasMaskTexture;

// Basic adjustments
uniform float u_exposure;    // -5.0 .. +5.0 EV
uniform float u_contrast;    // -1.0 .. +1.0
uniform float u_highlights;  // -1.0 .. +1.0
uniform float u_shadows;     // -1.0 .. +1.0
uniform float u_whites;      // -1.0 .. +1.0
uniform float u_blacks;      // -1.0 .. +1.0

// White balance
uniform float u_temperature; // -1.0 .. +1.0 (warm / cool)
uniform float u_tint;        // -1.0 .. +1.0 (magenta / green)

// Color & Vibrance
uniform float u_vibrance;    // -1.0 .. +1.0
uniform float u_saturation;  // -1.0 .. +1.0
uniform float u_bw;          // 0.0 or 1.0

// Effects
uniform float u_matte;       // 0.0 .. 1.0
uniform float u_vignette;    // -1.0 .. +1.0 (dark / light edges)
uniform float u_vigMidpoint; // 0.0 .. 1.0
uniform float u_vigRoundness;// -1.0 .. 1.0
uniform float u_vigFeather;  // 0.0 .. 1.0
uniform float u_grain;       // 0.0 .. 1.0
uniform float u_grainSize;   // 0.1 .. 2.0
uniform float u_grainRoughness; // 0.1 .. 2.0

// Color Grading (x: hue 0..360, y: sat 0..1, z: lum -1..1)
uniform vec3 u_cgShadows;
uniform vec3 u_cgMidtones;
uniform vec3 u_cgHighlights;
uniform float u_cgBlending; // 0.0 .. 1.0
uniform float u_cgBalance;  // -1.0 .. 1.0

// Lens Corrections
uniform bool u_removeCA;
uniform float u_lensDistortion;
uniform float u_lensVignette;

// Calibration
uniform float u_calibShadowTint;
uniform vec2 u_calibRed;   // hue, sat
uniform vec2 u_calibGreen; // hue, sat
uniform vec2 u_calibBlue;  // hue, sat

// HSL 8 bands (Hue shift, Saturation shift, Luminance shift)
// 0: Red, 1: Orange, 2: Yellow, 3: Green, 4: Aqua, 5: Blue, 6: Purple, 7: Magenta
uniform vec3 u_hslBands[8];

// Mask Uniforms
uniform int u_maskType;          // 0 = none, 1 = radial, 2 = linear, 3 = texture
uniform vec2 u_maskCenter;       // normalized (0..1)
uniform float u_maskRadius;      // normalized radius
uniform float u_maskAngle;       // angle in radians for linear
uniform float u_maskFeather;     // 0..1
uniform bool u_maskInvert;
uniform float u_maskExposure;    // -3.0 .. +3.0 EV
uniform float u_maskContrast;    // -1.0 .. +1.0
uniform float u_maskSaturation;  // -1.0 .. +1.0
uniform float u_maskTemperature; // -1.0 .. +1.0
uniform bool u_showMaskOverlay;  // O key red rubylith overlay

// Clipping warnings toggle
uniform bool u_showClipping;


// Convert sRGB to linear RGB
vec3 srgbToLinear(vec3 c) {
  return mix(
    c / 12.92,
    pow((c + 0.055) / 1.055, vec3(2.4)),
    step(0.04045, c)
  );
}

// Convert linear RGB to sRGB
vec3 linearToSrgb(vec3 c) {
  return mix(
    c * 12.92,
    1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055,
    step(0.0031308, c)
  );
}

// RGB to HSV conversion
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

// HSV to RGB conversion
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// Luminance according to Rec. 709
float getLuminance(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

// Procedural high-frequency noise for film grain
float hashNoise(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec2 coord = v_texCoord;
  if (u_lensDistortion != 0.0) {
    // Polynomial lens distortion correction (poly3 / poly5):
    // r_distorted = r * (1 + k1 * r^2)
    vec2 centered = coord - vec2(0.5);
    float r2 = dot(centered, centered);
    float factor = 1.0 + u_lensDistortion * r2;
    coord = vec2(0.5) + centered * factor;
  }

  // Discard fragments outside [0, 1] range after crop/geometry transform
  if (coord.x < 0.0 || coord.x > 1.0 || coord.y < 0.0 || coord.y > 1.0) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  vec4 srcColor;
  if (u_removeCA) {
    vec2 c = coord - vec2(0.5);
    float r = texture(u_image, vec2(0.5) + c * 0.9994).r;
    float g = texture(u_image, coord).g;
    float b = texture(u_image, vec2(0.5) + c * 1.0006).b;
    srcColor = vec4(r, g, b, 1.0);
  } else {
    srcColor = texture(u_image, coord);
  }
  vec3 rgb = srgbToLinear(srcColor.rgb);

  // 1. Exposure adjustment (in linear space: E = color * 2^EV)
  if (u_exposure != 0.0) {
    rgb *= exp2(u_exposure);
  }

  // 2. White Balance (Temperature & Tint in linear space)
  if (u_temperature != 0.0 || u_tint != 0.0) {
    // Temperature: warm (more R, less B) / cool (more B, less R)
    vec3 wb;
    wb.r = 1.0 + u_temperature * 0.4;
    wb.b = 1.0 - u_temperature * 0.4;
    // Tint: green / magenta
    wb.g = 1.0 - u_tint * 0.3;
    rgb *= wb;
  }

  // Convert back to perceptual sRGB-like gamma space for tonal and contrast adjustments
  rgb = linearToSrgb(rgb);

  // 3. Highlights & Shadows, Whites & Blacks tonal curve approximation
  float lum = getLuminance(rgb);

  // Highlights compression / expansion
  if (u_highlights != 0.0) {
    float hiMask = smoothstep(0.5, 1.0, lum);
    rgb += u_highlights * 0.5 * hiMask * (1.0 - rgb);
  }

  // Shadows recovery / deepening
  if (u_shadows != 0.0) {
    float shMask = 1.0 - smoothstep(0.0, 0.5, lum);
    rgb += u_shadows * 0.5 * shMask * rgb;
  }

  // Whites (upper extreme)
  if (u_whites != 0.0) {
    float whMask = smoothstep(0.75, 1.0, lum);
    rgb += u_whites * 0.3 * whMask;
  }

  // Blacks (lower extreme)
  if (u_blacks != 0.0) {
    float blMask = 1.0 - smoothstep(0.0, 0.25, lum);
    rgb += u_blacks * 0.3 * blMask;
  }

  // 4. Contrast (centered at 0.5 mid-gray with S-curve)
  if (u_contrast != 0.0) {
    rgb = (rgb - 0.5) * (1.0 + u_contrast) + 0.5;
  }

  // 5. Tone Curve LUT
  if (u_useCurve) {
    rgb.r = texture(u_curveLut, vec2(clamp(rgb.r, 0.0, 1.0), 0.5)).r;
    rgb.g = texture(u_curveLut, vec2(clamp(rgb.g, 0.0, 1.0), 0.5)).g;
    rgb.b = texture(u_curveLut, vec2(clamp(rgb.b, 0.0, 1.0), 0.5)).b;
  }

  // 6. HSL 8 Bands Adjustment
  vec3 hsv = rgb2hsv(clamp(rgb, 0.0, 1.0));
  float hue = hsv.x; // 0..1 representing 0..360 deg

  // Determine band weights based on hue
  // Red(0/1), Orange(0.08), Yellow(0.16), Green(0.33), Aqua(0.50), Blue(0.66), Purple(0.77), Magenta(0.88)
  float bandCenters[8] = float[8](0.0, 0.083, 0.166, 0.333, 0.500, 0.666, 0.777, 0.888);
  vec3 hslDelta = vec3(0.0);

  for (int i = 0; i < 8; i++) {
    float dist = abs(hue - bandCenters[i]);
    if (dist > 0.5) dist = 1.0 - dist;
    float weight = smoothstep(0.12, 0.0, dist);
    hslDelta += u_hslBands[i] * weight;
  }

  hsv.x = fract(hsv.x + hslDelta.x * 0.1);
  hsv.y = clamp(hsv.y * (1.0 + hslDelta.y), 0.0, 1.0);
  hsv.z = clamp(hsv.z + hslDelta.z * 0.2, 0.0, 1.0);
  rgb = hsv2rgb(hsv);

  // 7. Global Saturation & Vibrance
  float currentLum = getLuminance(rgb);
  if (u_saturation != 0.0) {
    rgb = mix(vec3(currentLum), rgb, 1.0 + u_saturation);
  }

  if (u_vibrance != 0.0) {
    // Vibrance affects less-saturated colors more than saturated ones
    float maxC = max(rgb.r, max(rgb.g, rgb.b));
    float minC = min(rgb.r, min(rgb.g, rgb.b));
    float sat = maxC - minC;
    float vibFactor = (1.0 - sat) * u_vibrance;
    rgb = mix(vec3(currentLum), rgb, 1.0 + vibFactor);
  }

  // 8. Black & White mode
  if (u_bw > 0.0) {
    float bwLum = getLuminance(rgb);
    rgb = mix(rgb, vec3(bwLum), u_bw);
  }

  // 8B. Color Grading (Shadows, Midtones, Highlights 3-Way Wheels)
  float cgLum = getLuminance(rgb);
  float balOffset = u_cgBalance * 0.25;

  // Shadows mask
  if (u_cgShadows.y > 0.0 || u_cgShadows.z != 0.0) {
    float shWeight = 1.0 - smoothstep(0.0, clamp(0.5 + balOffset, 0.1, 0.9), cgLum);
    vec3 shColor = hsv2rgb(vec3(u_cgShadows.x / 360.0, u_cgShadows.y, 1.0));
    rgb = mix(rgb, rgb * shColor, shWeight * (1.0 + u_cgShadows.z * 0.5));
  }

  // Highlights mask
  if (u_cgHighlights.y > 0.0 || u_cgHighlights.z != 0.0) {
    float hiWeight = smoothstep(clamp(0.5 + balOffset, 0.1, 0.9), 1.0, cgLum);
    vec3 hiColor = hsv2rgb(vec3(u_cgHighlights.x / 360.0, u_cgHighlights.y, 1.0));
    rgb = mix(rgb, rgb * hiColor, hiWeight * (1.0 + u_cgHighlights.z * 0.5));
  }

  // Midtones mask
  if (u_cgMidtones.y > 0.0 || u_cgMidtones.z != 0.0) {
    float midWeight = 1.0 - abs(cgLum - 0.5) * 2.0;
    midWeight = clamp(midWeight, 0.0, 1.0);
    vec3 midColor = hsv2rgb(vec3(u_cgMidtones.x / 360.0, u_cgMidtones.y, 1.0));
    rgb = mix(rgb, rgb * midColor, midWeight * (1.0 + u_cgMidtones.z * 0.5));
  }

  // 8C. Camera Calibration Primaries & Shadow Tint
  if (u_calibShadowTint != 0.0) {
    rgb.g += u_calibShadowTint * 0.05 * (1.0 - cgLum);
  }
  if (u_calibRed.x != 0.0 || u_calibRed.y != 0.0) {
    rgb.r = clamp(rgb.r * (1.0 + u_calibRed.y * 0.3) + u_calibRed.x * 0.1 * rgb.g, 0.0, 1.0);
  }
  if (u_calibGreen.x != 0.0 || u_calibGreen.y != 0.0) {
    rgb.g = clamp(rgb.g * (1.0 + u_calibGreen.y * 0.3) + u_calibGreen.x * 0.1 * rgb.b, 0.0, 1.0);
  }
  if (u_calibBlue.x != 0.0 || u_calibBlue.y != 0.0) {
    rgb.b = clamp(rgb.b * (1.0 + u_calibBlue.y * 0.3) + u_calibBlue.x * 0.1 * rgb.r, 0.0, 1.0);
  }

  // 9. Matte effect (lifts the blacks to give vintage faded film look)
  if (u_matte > 0.0) {
    rgb = mix(rgb, rgb * (1.0 - u_matte * 0.25) + vec3(u_matte * 0.15), u_matte);
  }

  // 10. Vignette (Post-crop & Lens vignette using global image coords)
  float totalVignette = u_vignette + u_lensVignette;
  if (totalVignette != 0.0) {
    vec2 centeredCoord = v_globalCoord - vec2(0.5);
    // Apply roundness
    float roundness = clamp(u_vigRoundness, -1.0, 1.0);
    float aspectDist = length(mix(abs(centeredCoord), vec2(length(centeredCoord)), (roundness + 1.0) * 0.5)) * 1.414;
    
    // Apply midpoint & feather
    float mid = clamp(u_vigMidpoint, 0.05, 0.95);
    float f = max(0.01, u_vigFeather);
    float vigFactor = smoothstep(mid * (1.0 - f * 0.5), mid + (1.0 - mid) * f, aspectDist);

    if (totalVignette < 0.0) {
      rgb *= (1.0 + totalVignette * vigFactor);
    } else {
      rgb = mix(rgb, vec3(1.0), totalVignette * vigFactor * 0.6);
    }
  }

  // 11. Film Grain (uses global image coords, size, roughness and procedural hash noise)
  if (u_grain > 0.0) {
    float scale = 1024.0 / max(0.2, u_grainSize);
    float noise = hashNoise(v_globalCoord * scale) - 0.5;
    if (u_grainRoughness > 0.5) {
      noise += (hashNoise(v_globalCoord * scale * 2.0) - 0.5) * (u_grainRoughness - 0.5);
    }
    rgb += noise * (u_grain * 0.25);
  }

  // 12. Local Mask Processing (Radial, Linear, Texture)
  if (u_maskType > 0) {
    float maskWeight = 0.0;

    if (u_maskType == 1) {
      // Radial Mask
      float dist = length(v_globalCoord - u_maskCenter);
      float innerR = u_maskRadius * (1.0 - clamp(u_maskFeather, 0.0, 0.99));
      maskWeight = 1.0 - smoothstep(innerR, max(u_maskRadius, 0.001), dist);
    } else if (u_maskType == 2) {
      // Linear Mask (Graduated Filter)
      vec2 dir = vec2(cos(u_maskAngle), sin(u_maskAngle));
      float proj = dot(v_globalCoord - u_maskCenter, dir);
      float f = max(0.01, u_maskFeather * 0.5);
      maskWeight = clamp(0.5 - proj / f, 0.0, 1.0);
    } else if (u_maskType == 3 && u_hasMaskTexture) {
      // Texture / Brush Mask
      maskWeight = texture(u_maskTexture, v_globalCoord).r;
    }

    if (u_maskInvert) {
      maskWeight = 1.0 - maskWeight;
    }

    // Apply local adjustments weighted by mask
    if (maskWeight > 0.0) {
      // Local exposure
      if (u_maskExposure != 0.0) {
        rgb *= exp2(u_maskExposure * maskWeight);
      }
      // Local contrast
      if (u_maskContrast != 0.0) {
        vec3 contrasted = (rgb - 0.5) * (1.0 + u_maskContrast) + 0.5;
        rgb = mix(rgb, contrasted, maskWeight);
      }
      // Local saturation
      if (u_maskSaturation != 0.0) {
        float localLum = getLuminance(rgb);
        vec3 saturated = mix(vec3(localLum), rgb, 1.0 + u_maskSaturation);
        rgb = mix(rgb, saturated, maskWeight);
      }
      // Local temperature
      if (u_maskTemperature != 0.0) {
        vec3 localWb = vec3(1.0 + u_maskTemperature * 0.35, 1.0, 1.0 - u_maskTemperature * 0.35);
        rgb = mix(rgb, rgb * localWb, maskWeight);
      }

      // Rubylith mask overlay (Lightroom 'O' key style)
      if (u_showMaskOverlay) {
        rgb = mix(rgb, vec3(0.9, 0.15, 0.15), maskWeight * 0.45);
      }
    }
  }

  // 13. Clipping warnings (J key toggle in Lightroom)
  if (u_showClipping) {

    if (rgb.r > 1.0 || rgb.g > 1.0 || rgb.b > 1.0) {
      // Highlight clipping in bright red
      fragColor = vec4(1.0, 0.0, 0.0, 1.0);
      return;
    }
    if (rgb.r < 0.0 || rgb.g < 0.0 || rgb.b < 0.0) {
      // Shadow clipping in bright blue
      fragColor = vec4(0.0, 0.2, 1.0, 1.0);
      return;
    }
  }

  fragColor = vec4(clamp(rgb, 0.0, 1.0), 1.0);
}
`;
