/**
 * Lumen Settings Schema — processVersion 1
 *
 * Single JSON blob stored in the `edits` table. Contains all
 * adjustments, geometry, curve, masks, and overlays.
 */

export interface HslBand {
  hue: number;        // -1..1
  saturation: number; // -1..1
  luminance: number;  // -1..1
}

export interface Geometry {
  rotation: 0 | 1 | 2 | 3;   // 90° increments
  flipH: boolean;
  flipV: boolean;
  straighten: number;          // -15..15 degrees
  cropRatio: number;           // 0 = free, >0 = w/h ratio
}

export interface MaskAdjustments {
  exposure: number;
  contrast: number;
  saturation: number;
  temperature: number;
}

export interface RadialMask {
  type: 'radial';
  x: number;          // 0..1 normalized
  y: number;          // 0..1 normalized
  radius: number;     // 0..1
  feather: number;    // 0..1
  invert: boolean;
  adjustments: MaskAdjustments;
}

export interface LinearMask {
  type: 'linear';
  x: number;
  y: number;
  angle: number;      // radians
  feather: number;
  invert: boolean;
  adjustments: MaskAdjustments;
}

export interface BrushMask {
  type: 'brush';
  strokes: { x: number; y: number }[][];  // polylines
  size: number;
  flow: number;
  density: number;
  erase: boolean;
  invert: boolean;
  adjustments: MaskAdjustments;
}

export interface LuminanceRangeMask {
  type: 'luminance-range';
  rangeMin: number;    // 0..1
  rangeMax: number;    // 0..1
  feather: number;
  invert: boolean;
  adjustments: MaskAdjustments;
}

export interface ColorRangeMask {
  type: 'color-range';
  targetHue: number;   // 0..1
  targetSat: number;   // 0..1
  range: number;        // tolerance
  feather: number;
  invert: boolean;
  adjustments: MaskAdjustments;
}

export type MaskDefinition =
  | RadialMask
  | LinearMask
  | BrushMask
  | LuminanceRangeMask
  | ColorRangeMask;

export interface StrokeOverlay {
  type: 'stroke';
  color: string;
  width: number;
  points: [number, number][];
}

export interface TextOverlay {
  type: 'text';
  x: number;
  y: number;
  color: string;
  size: number;
  text: string;
}

export type OverlayDefinition = StrokeOverlay | TextOverlay;

export const HSL_BAND_NAMES = [
  'Red', 'Orange', 'Yellow', 'Green', 'Aqua', 'Blue', 'Violet', 'Magenta',
] as const;

export const HSL_BAND_COLORS = [
  '#e33', '#f93', '#ee3', '#3b3', '#3cc', '#36f', '#93f', '#f3c',
] as const;

export interface ColorGradingWheel {
  hue: number;        // 0..360
  sat: number;        // 0..100
  lum: number;        // -100..100
}

export interface SpotAdjustment {
  id: string;
  x: number;          // 0..1
  y: number;          // 0..1
  sourceX: number;    // 0..1
  sourceY: number;    // 0..1
  radius: number;     // 0..1
  feather: number;    // 0..1
  opacity: number;    // 0..1
  mode: 'heal' | 'clone';
}

export interface RedEyeAdjustment {
  id: string;
  x: number;
  y: number;
  radius: number;
}

/**
 * Default settings for processVersion 1.
 */
export interface LumenSettings {
  processVersion: 1;

  // Basic
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  texture: number;
  clarity: number;
  dehaze: number;

  // Color
  temperature: number;
  tint: number;
  vibrance: number;
  saturation: number;
  bw: number;

  // Detail
  sharpen: number;
  sharpenRadius?: number;
  sharpenDetail?: number;
  sharpenMasking?: number;
  nrLum?: number;
  nrLumDetail?: number;
  nrColor?: number;
  blur: number;

  // Effects
  matte: number;
  vignette: number;
  vignetteMidpoint?: number;
  vignetteRoundness?: number;
  vignetteFeather?: number;
  grain: number;
  grainSize?: number;
  grainRoughness?: number;

  // HSL 8 bands
  hsl: HslBand[];

  // Curves (point and per-channel)
  curvePoints: [number, number][];
  rCurvePoints?: [number, number][];
  gCurvePoints?: [number, number][];
  bCurvePoints?: [number, number][];
  parametricCurve?: {
    highlights: number;
    lights: number;
    darks: number;
    shadows: number;
  };

  // Color Grading
  colorGrading?: {
    shadows: ColorGradingWheel;
    midtones: ColorGradingWheel;
    highlights: ColorGradingWheel;
    blending: number; // 0..100
    balance: number;  // -100..100
  };

  // Lens Corrections
  lensCorrections?: {
    removeChromaticAberration: boolean;
    distortion: number;
    lensVignette: number;
  };

  // Transform / Upright
  transform?: {
    vertical: number;
    horizontal: number;
    rotate: number;
    scale: number;
    aspect: number;
  };

  // Calibration
  calibration?: {
    profile: string;
    shadowTint: number;
    redPrimary: { hue: number; saturation: number };
    greenPrimary: { hue: number; saturation: number };
    bluePrimary: { hue: number; saturation: number };
  };

  // Spot removal & Red eye
  spots?: SpotAdjustment[];
  redEyes?: RedEyeAdjustment[];

  // Geometry
  geometry: Geometry;

  // Masks
  masks: MaskDefinition[];

  // Overlays
  overlays: OverlayDefinition[];
}

export function createDefaultSettings(): LumenSettings {
  return {
    processVersion: 1,
    exposure: 0,
    contrast: 0,
    highlights: 0,
    shadows: 0,
    whites: 0,
    blacks: 0,
    texture: 0,
    clarity: 0,
    dehaze: 0,
    temperature: 0,
    tint: 0,
    vibrance: 0,
    saturation: 0,
    bw: 0,
    sharpen: 0,
    sharpenRadius: 1.0,
    sharpenDetail: 25,
    sharpenMasking: 0,
    nrLum: 0,
    nrLumDetail: 50,
    nrColor: 25,
    blur: 0,
    matte: 0,
    vignette: 0,
    vignetteMidpoint: 50,
    vignetteRoundness: 0,
    vignetteFeather: 50,
    grain: 0,
    grainSize: 25,
    grainRoughness: 50,
    hsl: Array.from({ length: 8 }, () => ({ hue: 0, saturation: 0, luminance: 0 })),
    curvePoints: [[0, 0], [1, 1]],
    rCurvePoints: [[0, 0], [1, 1]],
    gCurvePoints: [[0, 0], [1, 1]],
    bCurvePoints: [[0, 0], [1, 1]],
    parametricCurve: {
      highlights: 0,
      lights: 0,
      darks: 0,
      shadows: 0,
    },
    colorGrading: {
      shadows: { hue: 0, sat: 0, lum: 0 },
      midtones: { hue: 0, sat: 0, lum: 0 },
      highlights: { hue: 0, sat: 0, lum: 0 },
      blending: 50,
      balance: 0,
    },
    lensCorrections: {
      removeChromaticAberration: false,
      distortion: 0,
      lensVignette: 0,
    },
    transform: {
      vertical: 0,
      horizontal: 0,
      rotate: 0,
      scale: 100,
      aspect: 0,
    },
    calibration: {
      profile: 'Adobe Color',
      shadowTint: 0,
      redPrimary: { hue: 0, saturation: 0 },
      greenPrimary: { hue: 0, saturation: 0 },
      bluePrimary: { hue: 0, saturation: 0 },
    },
    spots: [],
    redEyes: [],
    geometry: {
      rotation: 0,
      flipH: false,
      flipV: false,
      straighten: 0,
      cropRatio: 0,
    },
    masks: [],
    overlays: [],
  };
}

/**
 * Preset names from the prototype.
 */
export const BUILT_IN_PRESETS: Record<string, Partial<LumenSettings>> = {
  Original: {},
  Vivo: { contrast: 0.2, saturation: 0.25, vibrance: 0.3, sharpen: 0.4 },
  Cálido: { temperature: 0.35, tint: 0.05, saturation: 0.1, exposure: 0.1, vignette: -0.2 },
  Frío: { temperature: -0.35, contrast: 0.1, saturation: -0.05 },
  'B/N': { bw: 1, contrast: 0.35, vignette: -0.3, grain: 0.25 },
  Vintage: { matte: 0.5, temperature: 0.2, saturation: -0.2, contrast: -0.1, grain: 0.4, vignette: -0.4 },
  Cine: { temperature: -0.15, tint: -0.2, contrast: 0.25, saturation: -0.1, highlights: -0.2, shadows: 0.2, vignette: -0.3 },
  Mate: { matte: 0.6, contrast: -0.15, saturation: -0.1, shadows: 0.3 },
  Dramático: { contrast: 0.5, highlights: -0.4, shadows: 0.4, saturation: 0.1, sharpen: 0.8, vignette: -0.4 },
};

export const CROP_RATIOS: [string, number][] = [
  ['Original', 0],
  ['1:1', 1],
  ['4:3', 4 / 3],
  ['3:2', 3 / 2],
  ['16:9', 16 / 9],
  ['3:4', 3 / 4],
  ['2:3', 2 / 3],
  ['9:16', 9 / 16],
];
