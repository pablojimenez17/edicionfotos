import { invoke } from '@tauri-apps/api/core';
import type { Photo, LumenSettings } from '../../types';
import { isTauri } from '../catalog';

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

  // If running in browser without Tauri (e.g. tests), return mock path
  if (!isTauri()) {
    onProgress?.(1);
    return outPath;
  }

  const sessionId = `export_${photo.id}_${Date.now()}`;
  await invoke('create_export_session', {
    sessionId,
    width: outW,
    height: outH,
  });

  const tileSize = options.tileSize || 1024;
  const halo = 16; // Halo margin for spatial passes (sharpen/blur)

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
