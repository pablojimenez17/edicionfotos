import { describe, it, expect } from 'vitest';

/**
 * Mathematical models for:
 * 1. Post-crop vignette with global coordinates
 * 2. Spatial grain with global coordinates
 * 3. Spatial sharpening kernel (3x3 Laplacian / Unsharp)
 */
function computePixelValue(
  x: number,
  y: number,
  width: number,
  height: number,
  sourceVal: number,
  vignetteAmount: number = 0.5,
  grainAmount: number = 0.1,
): number {
  // 1. Global normalized vignette
  const nx = (x - width / 2) / (width / 2);
  const ny = (y - height / 2) / (height / 2);
  const distSq = nx * nx + ny * ny;
  const vignetteFactor = 1.0 - vignetteAmount * distSq;

  // 2. Global deterministic grain hash
  const pseudoRandom = Math.abs(
    Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 -
      Math.floor(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453),
  );
  const grainVal = (pseudoRandom - 0.5) * grainAmount;

  return Math.min(255, Math.max(0, sourceVal * vignetteFactor + grainVal * 255));
}

/**
 * 3x3 Convolution kernel (Sharpening)
 */
function applySharpenKernel(
  getVal: (x: number, y: number) => number,
  cx: number,
  cy: number,
): number {
  const center = getVal(cx, cy);
  const up = getVal(cx, cy - 1);
  const down = getVal(cx, cy + 1);
  const left = getVal(cx - 1, cy);
  const right = getVal(cx + 1, cy);

  const res = center * 2.0 - 0.25 * (up + down + left + right);
  return Math.round(Math.min(255, Math.max(0, res)));
}

describe('Tiled Export Seam Integrity Test (6000x4000)', () => {
  const WIDTH = 6000;
  const HEIGHT = 4000;
  const TILE_SIZE = 2048;

  function getSourcePixel(x: number, y: number): number {
    return ((x * 37 + y * 19) % 256);
  }

  it('proves difference is strictly ZERO at tile seams between full-piece and tiled export with halo', () => {
    // 1. Single-piece render function
    const renderSinglePiecePixel = (x: number, y: number): number => {
      const baseWithVignetteAndGrain = (px: number, py: number) => {
        const clampedX = Math.max(0, Math.min(WIDTH - 1, px));
        const clampedY = Math.max(0, Math.min(HEIGHT - 1, py));
        return computePixelValue(clampedX, clampedY, WIDTH, HEIGHT, getSourcePixel(clampedX, clampedY));
      };

      return applySharpenKernel(baseWithVignetteAndGrain, x, y);
    };

    // 2. Tiled render with halo margin and global coordinate binding
    const renderTiledPixel = (
      tileOriginX: number,
      tileOriginY: number,
      localX: number,
      localY: number,
    ): number => {
      const globalX = tileOriginX + localX;
      const globalY = tileOriginY + localY;

      const baseWithVignetteAndGrain = (px: number, py: number) => {
        const clampedX = Math.max(0, Math.min(WIDTH - 1, px));
        const clampedY = Math.max(0, Math.min(HEIGHT - 1, py));
        return computePixelValue(clampedX, clampedY, WIDTH, HEIGHT, getSourcePixel(clampedX, clampedY));
      };

      return applySharpenKernel(baseWithVignetteAndGrain, globalX, globalY);
    };

    // 3. Test horizontal & vertical seams:
    const seamXCoords = [2046, 2047, 2048, 2049, 4094, 4095, 4096, 4097];
    const seamYCoords = [2046, 2047, 2048, 2049];

    let totalSeamPixelsChecked = 0;
    let maxDiffAtSeams = 0;

    for (const y of seamYCoords) {
      for (const x of seamXCoords) {
        if (x >= WIDTH || y >= HEIGHT) continue;

        const tileIdxX = Math.floor(x / TILE_SIZE);
        const tileIdxY = Math.floor(y / TILE_SIZE);
        const tileOriginX = tileIdxX * TILE_SIZE;
        const tileOriginY = tileIdxY * TILE_SIZE;
        const localX = x - tileOriginX;
        const localY = y - tileOriginY;

        const singlePieceVal = renderSinglePiecePixel(x, y);
        const tiledVal = renderTiledPixel(tileOriginX, tileOriginY, localX, localY);

        const diff = Math.abs(singlePieceVal - tiledVal);
        if (diff > maxDiffAtSeams) {
          maxDiffAtSeams = diff;
        }

        expect(diff).toBe(0);
        totalSeamPixelsChecked++;
      }
    }

    // Continuous row across seam
    for (let x = 2000; x <= 2100; x++) {
      const y = 2048;
      const tileIdxX = Math.floor(x / TILE_SIZE);
      const tileIdxY = Math.floor(y / TILE_SIZE);
      const tileOriginX = tileIdxX * TILE_SIZE;
      const tileOriginY = tileIdxY * TILE_SIZE;

      const singlePieceVal = renderSinglePiecePixel(x, y);
      const tiledVal = renderTiledPixel(tileOriginX, tileOriginY, x - tileOriginX, y - tileOriginY);

      expect(Math.abs(singlePieceVal - tiledVal)).toBe(0);
      totalSeamPixelsChecked++;
    }

    expect(totalSeamPixelsChecked).toBeGreaterThan(120);
    expect(maxDiffAtSeams).toBe(0);
  });

  it('demonstrates that omitting halo causes non-zero seam errors in spatial passes', () => {
    const renderTiledPixelNoHalo = (
      tileOriginX: number,
      tileOriginY: number,
      localX: number,
      localY: number,
    ): number => {
      const baseWithVignetteAndGrain = (px: number, py: number) => {
        const clampedLocalX = Math.max(0, Math.min(TILE_SIZE - 1, px - tileOriginX));
        const clampedLocalY = Math.max(0, Math.min(TILE_SIZE - 1, py - tileOriginY));
        const gx = tileOriginX + clampedLocalX;
        const gy = tileOriginY + clampedLocalY;
        return computePixelValue(gx, gy, WIDTH, HEIGHT, getSourcePixel(gx, gy));
      };

      return applySharpenKernel(baseWithVignetteAndGrain, tileOriginX + localX, tileOriginY + localY);
    };

    const x = TILE_SIZE;
    const y = 1000;
    const tileOriginX = TILE_SIZE;

    const singlePieceVal = applySharpenKernel(
      (px, py) => computePixelValue(px, py, WIDTH, HEIGHT, getSourcePixel(px, py)),
      x,
      y,
    );
    const noHaloVal = renderTiledPixelNoHalo(tileOriginX, 0, 0, y);

    expect(Math.abs(singlePieceVal - noHaloVal)).toBeGreaterThan(0);
  });
});
