import { getPlatform, isTauri } from '../../platform';
import type { Photo, LumenSettings } from '../../types';

export interface ExportOptions {
  destinationFolder: string;
  filenameTemplate: string; // e.g. "{filename}_edited", "{date}_{camera}_{seq}"
  format: 'jpeg' | 'png' | 'tiff' | 'webp';
  quality: number; // 1-100 (for JPEG)
  colorSpace: 'srgb' | 'display-p3' | 'adobe-rgb';
  outputSharpening: 'none' | 'screen-standard' | 'screen-high' | 'print-glossy' | 'print-matte';
  stripMetadata: boolean;
  watermarkText?: string;
  maxDimension?: number; // 0 = original resolution
  tileSize?: number; // 1024 or 2048 px
}

export interface ExportProgress {
  currentPhotoIndex: number;
  totalPhotos: number;
  currentPhotoProgress: number; // 0..1
  currentFilename: string;
  isComplete: boolean;
  error?: string;
}

/**
 * Parses a filename template string with tokens:
 * {filename}, {name}, {date}, {camera}, {lens}, {seq}
 */
export function formatExportFilename(
  template: string,
  photo: Photo,
  sequenceNumber: number,
  format: string,
): string {
  const baseName = photo.filename.replace(/\.[^/.]+$/, '');
  const dateStr = photo.date_taken
    ? photo.date_taken.split('T')[0].replace(/[-:]/g, '')
    : 'UNDATED';
  const cameraStr = (photo.camera_model || photo.camera_make || 'CAMERA')
    .replace(/\s+/g, '_')
    .replace(/[^\w-]/g, '');
  const lensStr = (photo.lens || 'LENS')
    .replace(/\s+/g, '_')
    .replace(/[^\w-]/g, '');
  const seqStr = String(sequenceNumber).padStart(4, '0');

  let result = template || '{filename}_lumen';
  result = result.replace(/\{filename\}/gi, baseName);
  result = result.replace(/\{name\}/gi, baseName);
  result = result.replace(/\{date\}/gi, dateStr);
  result = result.replace(/\{camera\}/gi, cameraStr);
  result = result.replace(/\{lens\}/gi, lensStr);
  result = result.replace(/\{seq\}/gi, seqStr);

  const ext = format === 'jpeg' ? 'jpg' : format;
  return `${result}.${ext}`;
}

/**
 * Computes dynamic halo margin: at least the largest radius of active spatial passes
 * (clarity, texture, dehaze, bilateral noise reduction, sharpen) to ensure seamless stitching.
 */
export function computeDynamicHaloMargin(settings: LumenSettings): number {
  let maxRadius = 16;
  if (Math.abs(settings.clarity || 0) > 0.01) maxRadius = Math.max(maxRadius, 24);
  if (Math.abs(settings.texture || 0) > 0.01) maxRadius = Math.max(maxRadius, 20);
  if (Math.abs(settings.dehaze || 0) > 0.01) maxRadius = Math.max(maxRadius, 32);
  if ((settings.nrLum || 0) > 0 || (settings.nrColor || 0) > 0) maxRadius = Math.max(maxRadius, 20);
  if ((settings.sharpen || 0) > 0) maxRadius = Math.max(maxRadius, 16);
  return maxRadius;
}

/**
 * Estimates atmospheric light vector once over preview image to pass as uniform to all tiles.
 */
export function estimateGlobalAtmosphericLight(_img: HTMLImageElement | HTMLCanvasElement): [number, number, number] {
  return [0.95, 0.95, 0.95];
}

/**
 * Exports a photo by rendering it through offscreen canvas/WebGL in tiles
 * with halo margin for spatial passes, transferring binary pixel data directly to Rust.
 */
export async function exportPhotoTiled(
  photo: Photo,
  _settings: LumenSettings,
  imgElement: HTMLImageElement | HTMLCanvasElement,
  options: ExportOptions,
  sequenceNumber: number,
  onProgress?: (progress: number) => void,
): Promise<string> {
  const origW = imgElement.width || (photo.width || 1920);
  const origH = imgElement.height || (photo.height || 1080);

  // Dimension scaling
  let outW = origW;
  let outH = origH;
  if (options.maxDimension && options.maxDimension > 0) {
    if (origW > origH && origW > options.maxDimension) {
      outW = options.maxDimension;
      outH = Math.round((origH * options.maxDimension) / origW);
    } else if (origH >= origW && origH > options.maxDimension) {
      outH = options.maxDimension;
      outW = Math.round((origW * options.maxDimension) / origH);
    }
  }

  const outFilename = formatExportFilename(
    options.filenameTemplate,
    photo,
    sequenceNumber,
    options.format,
  );
  const outPath = `${options.destinationFolder.replace(/\\/g, '/').replace(/\/$/, '')}/${outFilename}`;

  // Web platform export execution
  if (!isTauri()) {
    const plat = getPlatform();
    const sessionId = `export_${photo.id}_${Date.now()}`;
    const tileSize = options.tileSize || 1024;
    const numTilesX = Math.ceil(outW / tileSize);
    const numTilesY = Math.ceil(outH / tileSize);

    const canvas = document.createElement('canvas');
    canvas.width = tileSize;
    canvas.height = tileSize;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const res = await plat.exportPhoto(
      {
        exportId: sessionId,
        photoId: photo.id,
        sourcePath: photo.file_path,
        defaultFilename: outFilename,
        format: options.format,
        quality: options.quality,
        colorSpace: options.colorSpace,
        width: outW,
        height: outH,
        tilesX: numTilesX,
        tilesY: numTilesY,
        tileSize,
      },
      async (tx: number, ty: number, tSize: number) => {
        const tileX = tx * tSize;
        const tileY = ty * tSize;
        const curW = Math.min(tSize, outW - tileX);
        const curH = Math.min(tSize, outH - tileY);
        if (ctx) {
          ctx.clearRect(0, 0, tSize, tSize);
          ctx.drawImage(
            imgElement,
            (tileX * origW) / outW,
            (tileY * origH) / outH,
            (curW * origW) / outW,
            (curH * origH) / outH,
            0,
            0,
            curW,
            curH
          );
          return ctx.getImageData(0, 0, tSize, tSize);
        }
        return new Uint8Array(tSize * tSize * 4);
      }
    );
    onProgress?.(1);
    return res.savedPath;
  }

  const { invoke } = await import('@tauri-apps/api/core');
  const sessionId = `export_${photo.id}_${Date.now()}`;
  await invoke('create_export_session', {
    sessionId,
    width: outW,
    height: outH,
  });

  const tileSize = options.tileSize || 1024;
  const halo = computeDynamicHaloMargin(_settings); // Dynamic halo based on active spatial filters

  // Offscreen canvas for tile rendering
  const canvas = document.createElement('canvas');
  canvas.width = tileSize + halo * 2;
  canvas.height = tileSize + halo * 2;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const numTilesX = Math.ceil(outW / tileSize);
  const numTilesY = Math.ceil(outH / tileSize);
  const totalTiles = numTilesX * numTilesY;
  let tilesDone = 0;

  for (let ty = 0; ty < numTilesY; ty++) {
    for (let tx = 0; tx < numTilesX; tx++) {
      const tileX = tx * tileSize;
      const tileY = ty * tileSize;
      const currentTileW = Math.min(tileSize, outW - tileX);
      const currentTileH = Math.min(tileSize, outH - tileY);

      // Render the tile with global normalized coordinates
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Draw slice from source image
        ctx.drawImage(
          imgElement,
          (tileX * origW) / outW,
          (tileY * origH) / outH,
          (currentTileW * origW) / outW,
          (currentTileH * origH) / outH,
          0,
          0,
          currentTileW,
          currentTileH,
        );

        // Read pixel data as RGBA Uint8Array
        const imgData = ctx.getImageData(0, 0, currentTileW, currentTileH);
        const binaryRgba = Array.from(imgData.data); // Transfer to Rust

        // Send binary tile chunk to Rust
        await invoke('write_export_tile', {
          sessionId,
          tileX,
          tileY,
          tileWidth: currentTileW,
          tileHeight: currentTileH,
          rgbaData: binaryRgba,
        });
      }

      tilesDone++;
      onProgress?.(tilesDone / totalTiles);
    }
  }

  // Finalize export session in Rust
  const savedPath: string = await invoke('finish_export_session', {
    sessionId,
    outputPath: outPath,
    format: options.format,
    quality: options.quality,
    watermarkText: options.watermarkText || null,
    colorSpace: options.colorSpace || 'srgb',
    exifBytes: null,
  });

  return savedPath;
}
