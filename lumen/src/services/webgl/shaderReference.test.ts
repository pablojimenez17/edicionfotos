import { describe, it, expect } from 'vitest';
import { BUILT_IN_PRESETS, type LumenSettings, createDefaultSettings } from '../../types';

/**
 * Pure mathematical reference implementation of the Lumen Uber-Shader pipeline.
 * Replicates the exact formulas executed in GLSL ES 3.00.
 */
function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  const clamped = Math.max(0, c);
  return clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * Math.pow(clamped, 1.0 / 2.4) - 0.055;
}

function getLuminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function evaluateShaderReference(
  srcR: number,
  srcG: number,
  srcB: number,
  settings: LumenSettings,
): [number, number, number] {
  // Convert [0..255] to [0..1]
  let r = srcR / 255.0;
  let g = srcG / 255.0;
  let b = srcB / 255.0;

  // 1. sRGB to linear
  r = srgbToLinear(r);
  g = srgbToLinear(g);
  b = srgbToLinear(b);

  // 2. Exposure
  if (settings.exposure !== 0) {
    const factor = Math.pow(2.0, settings.exposure);
    r *= factor;
    g *= factor;
    b *= factor;
  }

  // 3. White Balance (Temp & Tint in linear space)
  if (settings.temperature !== 0 || settings.tint !== 0) {
    r *= 1.0 + settings.temperature * 0.4;
    g *= 1.0 - settings.tint * 0.3;
    b *= 1.0 - settings.temperature * 0.4;
  }

  // 4. Linear to perceptual sRGB
  r = linearToSrgb(r);
  g = linearToSrgb(g);
  b = linearToSrgb(b);

  // 5. Contrast
  if (settings.contrast !== 0) {
    r = (r - 0.5) * (1.0 + settings.contrast) + 0.5;
    g = (g - 0.5) * (1.0 + settings.contrast) + 0.5;
    b = (b - 0.5) * (1.0 + settings.contrast) + 0.5;
  }

  // 6. Saturation & Vibrance
  const lum = getLuminance(r, g, b);
  if (settings.saturation !== 0) {
    r = lum + (r - lum) * (1.0 + settings.saturation);
    g = lum + (g - lum) * (1.0 + settings.saturation);
    b = lum + (b - lum) * (1.0 + settings.saturation);
  }

  if (settings.vibrance !== 0) {
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const sat = maxC - minC;
    const factor = (1.0 - sat) * settings.vibrance;
    r = lum + (r - lum) * (1.0 + factor);
    g = lum + (g - lum) * (1.0 + factor);
    b = lum + (b - lum) * (1.0 + factor);
  }

  // Clamp to [0, 1] and scale back to [0, 255]
  return [
    Math.round(Math.min(1.0, Math.max(0.0, r)) * 255),
    Math.round(Math.min(1.0, Math.max(0.0, g)) * 255),
    Math.round(Math.min(1.0, Math.max(0.0, b)) * 255),
  ];
}

describe('Develop Shader Reference Invariance Tests', () => {
  // Test Image 1: Linear Gray Gradient
  const gradientImage = [
    [0, 0, 0],       // Black
    [64, 64, 64],    // Dark gray
    [128, 128, 128], // Mid gray
    [255, 255, 255], // White
  ];

  // Test Image 2: Primary and Secondary Colors
  const primaryColorsImage = [
    [255, 0, 0],     // Pure Red
    [0, 255, 0],     // Pure Green
    [0, 0, 255],     // Pure Blue
    [255, 255, 0],   // Yellow
  ];

  // Test Image 3: Skin Tone & Neutral Tones
  const skinToneImage = [
    [230, 180, 150], // Caucasian skin tone
    [160, 110, 80],  // Tan / Olive skin tone
    [90, 60, 45],    // Dark skin tone
    [192, 192, 192], // Neutral 75%
  ];

  it('preserves exact mathematical output for Image 1 (Gradient) with "Vivo" preset', () => {
    const vivoSettings: LumenSettings = {
      ...createDefaultSettings(),
      ...BUILT_IN_PRESETS['Vivo'],
    };

    const results = gradientImage.map(([r, g, b]) =>
      evaluateShaderReference(r, g, b, vivoSettings),
    );

    // Expected exact deterministic values computed from pipeline
    expect(results).toEqual([
      [0, 0, 0],
      [51, 51, 51],
      [128, 128, 128],
      [255, 255, 255],
    ]);
  });

  it('preserves exact mathematical output for Image 2 (Primary Colors) with "Cálido" preset', () => {
    const calidoSettings: LumenSettings = {
      ...createDefaultSettings(),
      ...BUILT_IN_PRESETS['Cálido'],
    };

    const results = primaryColorsImage.map(([r, g, b]) =>
      evaluateShaderReference(r, g, b, calidoSettings),
    );

    // Primary saturated colors after warm white balance & saturation
    expect(results).toEqual([
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255],
      [255, 255, 0],
    ]);
  });

  it('preserves exact mathematical output for Image 3 (Skin & Neutrals) with "Vivo" preset', () => {
    const vivoSettings: LumenSettings = {
      ...createDefaultSettings(),
      ...BUILT_IN_PRESETS['Vivo'],
    };

    const results = skinToneImage.map(([r, g, b]) =>
      evaluateShaderReference(r, g, b, vivoSettings),
    );

    expect(results[0][0]).toBeGreaterThan(results[0][1]); // R > G for skin
    expect(results).toEqual([
      [255, 186, 134],
      [189, 102, 50],
      [98, 43, 16],
      [205, 205, 205],
    ]);
  });

});
