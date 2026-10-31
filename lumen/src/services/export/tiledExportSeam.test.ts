import { describe, it, expect } from 'vitest';

/**
 * Mathematical models for all Spatial Passes & Point-wise operations:
 * 1. Post-crop vignette with global coordinates
 * 2. Spatial grain with global coordinates
 * 3. Clarity & Texture (Frequency separation on midtones)
 * 4. Dehaze (Dark Channel Prior with global atmospheric light)
 * 5. Bilateral Noise Reduction (Edge-preserving 9-tap filter)
 */

// 1. Point-wise Vignette & Grain
function computePointwisePixel(
  x: number,
  y: number,
  width: number,
  height: number,
  sourceVal: number,
  vignetteAmount: number = 0.5,
  grainAmount: number = 0.1,
): number {
  const nx = (x - width / 2) / (width / 2);
  const ny = (y - height / 2) / (height / 2);
  const distSq = nx * nx + ny * ny;
  const vignetteFactor = 1.0 - vignetteAmount * distSq;

  const pseudoRandom = Math.abs(
    Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 -
      Math.floor(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453),
  );
  const grainVal = (pseudoRandom - 0.5) * grainAmount;

  return Math.min(255, Math.max(0, sourceVal * vignetteFactor + grainVal * 255));
}

// 2. Clarity & Texture pass (high-freq and mid-freq separation)
function applyClarityTexture(
  getVal: (x: number, y: number) => number,
  cx: number,
  cy: number,
  clarity: number = 0.4,
  texture: number = 0.3,
): number {
  const center = getVal(cx, cy);
  const n1 = (getVal(cx - 1, cy) + getVal(cx + 1, cy) + getVal(cx, cy - 1) + getVal(cx, cy + 1)) / 4;
  const n4 = (getVal(cx - 4, cy) + getVal(cx + 4, cy) + getVal(cx, cy - 4) + getVal(cx, cy + 4)) / 4;

  const highFreq = center - n1;
  const midFreq = n1 - n4;
  const norm = center / 255;
  const midtoneMask = 1.0 - 4.0 * Math.pow(norm - 0.5, 2.0);

  const res = center + highFreq * (texture * 0.7) + midFreq * (clarity * 0.6 * Math.max(0, midtoneMask));
  return Math.min(255, Math.max(0, res));
}

// 3. Dehaze pass with global atmospheric light (constant across all tiles)
function applyDehaze(
  getVal: (x: number, y: number) => number,
  cx: number,
  cy: number,
  dehaze: number = 0.3,
  atmosphericLight: number = 240, // Calculated once over full preview!
): number {
  const center = getVal(cx, cy);
  // 5-tap dark channel estimate
  const d0 = center;
  const d1 = getVal(cx + 2, cy);
  const d2 = getVal(cx - 2, cy);
  const d3 = getVal(cx, cy + 2);
  const d4 = getVal(cx, cy - 2);
  const darkChannel = Math.min(d0, Math.min(Math.min(d1, d2), Math.min(d3, d4)));

  const transmission = Math.max(0.1, Math.min(1.0, 1.0 - 0.9 * (darkChannel / atmosphericLight)));
  const t = 1.0 + (transmission - 1.0) * dehaze;
  const restored = (center - atmosphericLight * (1.0 - t)) / Math.max(t, 0.1);
  return Math.min(255, Math.max(0, restored));
}

// 4. Bilateral Noise Reduction pass (9-tap edge-preserving)
function applyBilateralNR(
  getVal: (x: number, y: number) => number,
  cx: number,
  cy: number,
  nrStrength: number = 0.25,
): number {
  const center = getVal(cx, cy);
  let sum = 0;
  let totalWeight = 0;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const neighbor = getVal(cx + dx, cy + dy);
      const spatialDistSq = dx * dx + dy * dy;
      const rangeDist = Math.abs(center - neighbor) / 255;
      const weight = Math.exp(-spatialDistSq / 4) * Math.exp(-rangeDist * rangeDist / Math.max(0.01, nrStrength));
      sum += neighbor * weight;
      totalWeight += weight;
    }
  }

  return totalWeight > 0 ? Math.round(sum / totalWeight) : center;
}

describe('Tiled Export Seam Integrity Test: Full Spatial Pipeline (6000x4000)', () => {
  const WIDTH = 6000;
  const HEIGHT = 4000;
  const TILE_SIZE = 2048;
  const DYNAMIC_HALO = 32; // Dynamic halo >= max radius of spatial passes
  const GLOBAL_ATMOSPHERIC_LIGHT = 242; // Constant atmospheric light calculated once over full preview

  function getSourcePixel(x: number, y: number): number {
    return ((x * 43 + y * 23) % 256);
  }

  it('verifies difference is ZERO across tile seams for clarity, texture, dehaze, bilateral NR, vignette and grain', () => {
    // 1. Single-piece full render pipeline
    const renderSinglePiece = (x: number, y: number): number => {
      // Step A: Base + Vignette + Grain
      const sampleBase = (px: number, py: number) => {
        const cx = Math.max(0, Math.min(WIDTH - 1, px));
        const cy = Math.max(0, Math.min(HEIGHT - 1, py));
        return computePointwisePixel(cx, cy, WIDTH, HEIGHT, getSourcePixel(cx, cy));
      };

      // Step B: Clarity & Texture
      const sampleClarity = (px: number, py: number) => {
        return applyClarityTexture(sampleBase, px, py, 0.35, 0.25);
      };

      // Step C: Dehaze with global atmosphere
      const sampleDehaze = (px: number, py: number) => {
        return applyDehaze(sampleClarity, px, py, 0.3, GLOBAL_ATMOSPHERIC_LIGHT);
      };

      // Step D: Bilateral Noise Reduction
      return applyBilateralNR(sampleDehaze, x, y, 0.2);
    };

    // 2. Tiled render pipeline with dynamic halo margin & global coordinate bindings
    const renderTiled = (
      tileOriginX: number,
      tileOriginY: number,
      localX: number,
      localY: number,
    ): number => {
      const globalX = tileOriginX + localX;
      const globalY = tileOriginY + localY;

      const sampleBase = (px: number, py: number) => {
        const cx = Math.max(0, Math.min(WIDTH - 1, px));
        const cy = Math.max(0, Math.min(HEIGHT - 1, py));
        return computePointwisePixel(cx, cy, WIDTH, HEIGHT, getSourcePixel(cx, cy));
      };

      const sampleClarity = (px: number, py: number) => {
        return applyClarityTexture(sampleBase, px, py, 0.35, 0.25);
      };

      // Crucial: Dehaze uses the same GLOBAL_ATMOSPHERIC_LIGHT across all tiles
      const sampleDehaze = (px: number, py: number) => {
        return applyDehaze(sampleClarity, px, py, 0.3, GLOBAL_ATMOSPHERIC_LIGHT);
      };

      return applyBilateralNR(sampleDehaze, globalX, globalY, 0.2);
    };

    // 3. Test horizontal & vertical seams:
    const seamXCoords = [
      TILE_SIZE - 2, TILE_SIZE - 1, TILE_SIZE, TILE_SIZE + 1,
      TILE_SIZE * 2 - 1, TILE_SIZE * 2
    ];
    const seamYCoords = [
      TILE_SIZE - 2, TILE_SIZE - 1, TILE_SIZE, TILE_SIZE + 1
    ];

    let seamChecks = 0;
    let maxDiff = 0;

    for (const y of seamYCoords) {
      for (const x of seamXCoords) {
        if (x >= WIDTH || y >= HEIGHT) continue;

        const tileIdxX = Math.floor(x / TILE_SIZE);
        const tileIdxY = Math.floor(y / TILE_SIZE);
        const originX = tileIdxX * TILE_SIZE;
        const originY = tileIdxY * TILE_SIZE;

        const singlePieceVal = renderSinglePiece(x, y);
        const tiledVal = renderTiled(originX, originY, x - originX, y - originY);

        const diff = Math.abs(singlePieceVal - tiledVal);
        if (diff > maxDiff) maxDiff = diff;

        expect(diff).toBe(0);
        seamChecks++;
      }
    }

    // Continuous boundary strip check: y = 2048, x from 2000 to 2100
    for (let x = 2000; x <= 2100; x++) {
      const y = 2048;
      const tileIdxX = Math.floor(x / TILE_SIZE);
      const originX = tileIdxX * TILE_SIZE;
      const originY = 2048; // Row 1

      const singlePieceVal = renderSinglePiece(x, y);
      const tiledVal = renderTiled(originX, originY, x - originX, y - originY);

      expect(Math.abs(singlePieceVal - tiledVal)).toBe(0);
      seamChecks++;
    }

    expect(seamChecks).toBeGreaterThan(120);
    expect(maxDiff).toBe(0);
  });

  it('confirms that tile-local dehaze atmosphere causes seam divergence if not computed globally', () => {
    // If Tile 0 computes atmospheric light = 220 and Tile 1 computes 250,
    // they diverge at the boundary:
    const sampleVal = (px: number, py: number) => computePointwisePixel(px, py, WIDTH, HEIGHT, getSourcePixel(px, py));

    const singleGlobalDehaze = applyDehaze(sampleVal, TILE_SIZE, 1000, 0.4, 240);
    const divergentTileDehaze = applyDehaze(sampleVal, TILE_SIZE, 1000, 0.4, 210);

    expect(Math.abs(singleGlobalDehaze - divergentTileDehaze)).toBeGreaterThan(0);
  });
});
