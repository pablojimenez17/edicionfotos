/**
 * RAW Preview Extractor for Web environment.
 * Extracts embedded JPEG preview from Canon (.CR2), Nikon (.NEF), Sony (.ARW) and Adobe (.DNG).
 * Also prepares interface for future WebAssembly build of rawloader.
 */
import { toast } from '../../stores/toast';

export interface RawDecodeResult {
  blob: Blob;
  url: string;
  isEmbeddedPreview: boolean;
  width?: number;
  height?: number;
}

/**
 * Fast search for embedded JPEG within RAW binary buffer.
 */
export function findEmbeddedJpegInRaw(data: Uint8Array): Uint8Array | null {
  const len = data.length;
  let start = -1;

  // Search for JPEG SOI (0xFF 0xD8 0xFF)
  // Usually embedded preview is located within the first 4 MB or at least after offset 1024
  for (let i = 0; i < len - 3; i++) {
    if (data[i] === 0xff && data[i + 1] === 0xd8 && data[i + 2] === 0xff) {
      // Found JPEG start marker
      start = i;
      break;
    }
  }

  if (start === -1) return null;

  // Find JPEG EOI (0xFF 0xD9) scanning from end backwards for maximum resolution preview
  let end = -1;
  for (let i = len - 2; i > start; i--) {
    if (data[i] === 0xff && data[i + 1] === 0xd9) {
      end = i + 2;
      break;
    }
  }

  if (end > start && end - start > 1024) {
    return data.slice(start, end);
  }

  return null;
}

/**
 * Extracts the embedded preview JPEG from a RAW file blob.
 */
export async function extractWebRawPreview(
  fileOrBlob: Blob | Uint8Array,
  filename: string
): Promise<RawDecodeResult> {
  const buffer =
    fileOrBlob instanceof Blob
      ? new Uint8Array(await fileOrBlob.arrayBuffer())
      : fileOrBlob;

  const jpegBytes = findEmbeddedJpegInRaw(buffer);

  if (jpegBytes && jpegBytes.length > 5000) {
    const previewBlob = new Blob([jpegBytes as any], { type: 'image/jpeg' });
    const url = URL.createObjectURL(previewBlob);

    return {
      blob: previewBlob,
      url,
      isEmbeddedPreview: true,
    };
  }

  // Fallback: if no valid JPEG SOI was found, return raw blob or placeholder
  toast.warning(
    `No se pudo extraer vista previa embebida de "${filename}". El revelado RAW completo a 16-bit está disponible en la app de escritorio.`
  );
  const fallbackBlob = fileOrBlob instanceof Blob ? fileOrBlob : new Blob([fileOrBlob as any]);
  return {
    blob: fallbackBlob,
    url: URL.createObjectURL(fallbackBlob),
    isEmbeddedPreview: true,
  };
}

/**
 * Future WebAssembly compilation hook for rawloader / rawler.
 * When rawloader-wasm is compiled, this module will execute full 16-bit
 * Bayer demosaicing directly in the browser.
 */
export async function compileRawloaderWasm(): Promise<boolean> {
  // Currently returning false to use embedded preview fallback with user notice
  return false;
}
