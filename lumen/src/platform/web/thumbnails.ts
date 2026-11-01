/**
 * Web Thumbnail Generator & Cache.
 * Leverages createImageBitmap with hardware downscaling, EXIF embedded thumbnail extraction,
 * and persistent storage in OPFS.
 */
import { readFileFromOpfs } from './handles';

const thumbUrlCache = new Map<number, string>();

/**
 * Checks if a JPEG has an embedded EXIF thumbnail in APP1.
 */
export function extractExifThumbnail(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length < 128) return null;
  // JPEG SOI
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let offset = 2;
  while (offset < bytes.length - 4) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1];
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];

    // APP1 (EXIF)
    if (marker === 0xe1) {
      // Look for second SOI marker inside APP1
      for (let j = offset + 4; j < offset + 2 + length - 2; j++) {
        if (bytes[j] === 0xff && bytes[j + 1] === 0xd8 && bytes[j + 2] === 0xff) {
          // Found start of embedded thumbnail
          for (let k = j + 2; k < offset + 2 + length - 1; k++) {
            if (bytes[k] === 0xff && bytes[k + 1] === 0xd9) {
              return bytes.slice(j, k + 2);
            }
          }
        }
      }
    }

    if (marker === 0xda) break; // Start of Scan (image data)
    offset += 2 + length;
  }
  return null;
}

/**
 * Saves thumbnail blob to OPFS cache.
 */
async function saveThumbToOpfs(photoId: number, blob: Blob): Promise<string | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) return null;
  try {
    const root = await navigator.storage.getDirectory();
    const previewsDir = await root.getDirectoryHandle('previews', { create: true });
    const thumbsDir = await previewsDir.getDirectoryHandle('thumbs', { create: true });
    const fileHandle = await thumbsDir.getFileHandle(`${photoId}.jpg`, { create: true });
    const writable = await (fileHandle as any).createWritable();
    await writable.write(await blob.arrayBuffer());
    await writable.close();
    return `/opfs/previews/thumbs/${photoId}.jpg`;
  } catch (err) {
    console.warn('No se pudo guardar miniatura en OPFS:', err);
    return null;
  }
}

/**
 * Generates and caches a thumbnail for a given photo.
 */
export async function generateWebThumbnail(
  photoId: number,
  sourceBlob: Blob,
  targetWidth = 320
): Promise<string> {
  const cached = thumbUrlCache.get(photoId);
  if (cached) return cached;

  // 1. Try reading existing cached thumbnail from OPFS
  const opfsThumbBytes = await readFileFromOpfs(`/opfs/previews/thumbs/${photoId}.jpg`);
  if (opfsThumbBytes) {
    const blob = new Blob([opfsThumbBytes as any], { type: 'image/jpeg' });
    const url = URL.createObjectURL(blob);
    thumbUrlCache.set(photoId, url);
    return url;
  }

  // 2. Try fast EXIF thumbnail extraction
  const arrayBuffer = await sourceBlob.arrayBuffer();
  const exifThumb = extractExifThumbnail(new Uint8Array(arrayBuffer));
  if (exifThumb && exifThumb.length > 2000) {
    const blob = new Blob([exifThumb as any], { type: 'image/jpeg' });
    await saveThumbToOpfs(photoId, blob);
    const url = URL.createObjectURL(blob);
    thumbUrlCache.set(photoId, url);
    return url;
  }

  // 3. Fallback: downscale with createImageBitmap or offscreen canvas
  try {
    let bmp: ImageBitmap | null = null;
    if (typeof createImageBitmap === 'function') {
      try {
        bmp = await createImageBitmap(sourceBlob, {
          resizeWidth: targetWidth,
          resizeQuality: 'medium',
        });
      } catch {
        bmp = await createImageBitmap(sourceBlob);
      }
    }

    const canvas = document.createElement('canvas');
    if (bmp) {
      const scale = targetWidth / bmp.width;
      canvas.width = targetWidth;
      canvas.height = Math.max(1, Math.round(bmp.height * (scale < 1 ? scale : 1)));
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      }
      bmp.close();
    }

    const thumbBlob = await new Promise<Blob>((resolve) => {
      canvas.toBlob(
        (b) => resolve(b || sourceBlob),
        'image/jpeg',
        0.82
      );
    });

    await saveThumbToOpfs(photoId, thumbBlob);
    const url = URL.createObjectURL(thumbBlob);
    thumbUrlCache.set(photoId, url);
    return url;
  } catch (err) {
    console.warn('Error generando miniatura con canvas:', err);
    const url = URL.createObjectURL(sourceBlob);
    thumbUrlCache.set(photoId, url);
    return url;
  }
}
